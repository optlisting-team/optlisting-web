import React, { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // FIX: if we've just landed back from an OAuth redirect (#access_token=... in the URL),
    // supabase-js needs a moment to parse that hash and turn it into a session. If our own
    // getSession() call below resolves first with no session, we'd set loading=false + user=null,
    // and ProtectedRoute would immediately redirect to /login — replacing the URL and wiping the
    // #access_token hash before supabase-js ever gets to process it, permanently losing the
    // session. This was the root cause of both the "flashes back to login" jank on every Google
    // sign-in and the outright "signs in then bounces back to login" failure.
    const hasPendingOAuthHash =
      typeof window !== 'undefined' &&
      window.location.hash &&
      window.location.hash.includes('access_token')

    // Get current session
    const getSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error) throw error

        if (session) {
          setSession(session)
          setUser(session.user)
          setLoading(false)
        } else if (hasPendingOAuthHash) {
          // Don't resolve loading yet — an OAuth redirect is still being processed.
          // onAuthStateChange below will fire (SIGNED_IN) once supabase-js finishes
          // parsing the hash, and that handler will set loading=false.
          console.log('⏳ OAuth redirect detected, waiting for session to be established...')
        } else {
          setSession(null)
          setUser(null)
          setLoading(false)
        }
      } catch (error) {
        console.error('Failed to get session:', error)
        setLoading(false)
      }
    }

    getSession()

    // Auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth event:', event)
        setSession(session)
        setUser(session?.user ?? null)
        setLoading(false)
      }
    )

    // Safety net: if an OAuth hash was present but no session ever materializes
    // (e.g. an actually-invalid/expired token), don't leave the app stuck loading forever.
    let fallbackTimer
    if (hasPendingOAuthHash) {
      fallbackTimer = setTimeout(() => {
        setLoading((current) => {
          if (current) {
            console.warn('⚠️ OAuth session did not establish within 5s, giving up wait')
          }
          return false
        })
      }, 5000)
    }

    return () => {
      subscription?.unsubscribe()
      if (fallbackTimer) clearTimeout(fallbackTimer)
    }
  }, [])

  // Google sign in
  const signInWithGoogle = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
            // Domain settings to display on Google OAuth consent screen
            // Note: The order of authorized domains in Google Cloud Console OAuth consent screen takes priority
            // If optlisting.com is set first, it will be displayed on Google login screen
          },
          // Scope settings
          scopes: 'email profile',
        },
      })
      
      if (error) throw error
      return { data, error: null }
    } catch (error) {
      console.error('Google sign in failed:', error)
      return { data: null, error }
    } finally {
      setLoading(false)
    }
  }

  // Email sign in (optional)
  const signInWithEmail = async (email, password) => {
    try {
      setLoading(true)
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      
      if (error) throw error
      return { data, error: null }
    } catch (error) {
      console.error('Email sign in failed:', error)
      return { data: null, error }
    } finally {
      setLoading(false)
    }
  }

  // Sign up
  const signUp = async (email, password) => {
    try {
      setLoading(true)
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      })
      
      if (error) throw error
      return { data, error: null }
    } catch (error) {
      console.error('Sign up failed:', error)
      return { data: null, error }
    } finally {
      setLoading(false)
    }
  }

  // Sign out
  const signOut = async () => {
    try {
      setLoading(true)
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      
      setUser(null)
      setSession(null)
    } catch (error) {
      console.error('Sign out failed:', error)
    } finally {
      setLoading(false)
    }
  }

  // Update profile
  const updateProfile = async (updates) => {
    try {
      const { data, error } = await supabase.auth.updateUser(updates)
      if (error) throw error
      return { data, error: null }
    } catch (error) {
      console.error('Profile update failed:', error)
      return { data: null, error }
    }
  }

  const value = {
    user,
    session,
    loading,
    signInWithGoogle,
    signInWithEmail,
    signUp,
    signOut,
    updateProfile,
    isAuthenticated: !!user,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export default AuthContext

