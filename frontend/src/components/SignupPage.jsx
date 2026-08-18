import React, { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { motion } from 'framer-motion'
import { AlertCircle, Loader2, ArrowLeft, CheckCircle } from 'lucide-react'
import BrandLogo from './BrandLogo'

function SignupPage() {
  const navigate = useNavigate()
  const { signInWithGoogle, isAuthenticated, loading: authLoading } = useAuth()
  
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Redirect to dashboard if already logged in
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard')
    }
  }, [isAuthenticated, navigate])

  const handleGoogleSignup = async () => {
    setError('')
    setLoading(true)
    
    const { error } = await signInWithGoogle()
    
    if (error) {
      setError(error.message || 'Google login failed.')
    }
    setLoading(false)
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F7F9FC] flex items-center justify-center">
        <div className="animate-spin">
          <Loader2 className="w-8 h-8 text-brand-navy" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F7F9FC] flex items-center justify-center p-4 text-brand-navy">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-x-0 top-0 h-64 bg-blue-50/60" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Back to Home */}
        <Link 
          to="/"
          className="inline-flex items-center gap-2 text-slate-500 hover:text-brand-navy mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Home</span>
        </Link>

        {/* Signup Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-[0_20px_60px_-40px_rgba(13,27,61,0.35)]">
          {/* Logo */}
          <BrandLogo size="lg" tone="dark" className="flex justify-center mb-8" />

          <h1 className="text-xl font-bold text-brand-navy text-center mb-2">
            Start Your Free Trial
          </h1>
          <p className="text-slate-500 text-center mb-6">
            Try Pro free for 7 days
          </p>

          {/* Benefits */}
          <div className="mb-6 space-y-2">
            {[
              'Up to 30,000 active listings',
              'Full Inventory Diagnostic Dashboard',
              'Views, Impressions, Watchers & Sales analytics',
              'Dead stock detection & cleanup recommendations',
            ].map((benefit, index) => (
              <div key={index} className="flex items-center gap-2 text-sm text-slate-700">
                <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>{benefit}</span>
              </div>
            ))}
          </div>

          {/* Error Message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-3"
            >
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-400">{error}</p>
            </motion.div>
          )}

          {/* Google Signup Button */}
          <button
            onClick={handleGoogleSignup}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-4 bg-white hover:bg-gray-100 text-gray-800 font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <span>Continue with Google</span>
              </>
            )}
          </button>

          {/* Footer Links */}
          <div className="mt-6 text-center">
            <Link
              to="/login"
              className="text-sm text-slate-500 hover:text-brand-navy transition-colors"
            >
              Already have an account? <span className="font-semibold text-brand-navy">Sign in</span>
            </Link>
          </div>

          {/* Info Text */}
          <p className="mt-4 text-center text-xs text-slate-500">
            By signing up, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>

        {/* Trust Badge */}
        <div className="mt-6 text-center">
          <p className="text-xs text-slate-500">
            Your data is secured with enterprise-grade encryption
          </p>
        </div>
      </motion.div>
    </div>
  )
}

export default SignupPage
