/**
 * Axios instance configuration - Automatic JWT authentication header
 * Automatically adds Authorization header to all API requests.
 */
import axios from 'axios'
import { supabase } from './supabase'

// API Base URL configuration
// Production: Direct request to Railway backend, bypassing Vercel serverless functions
const API_BASE_URL = import.meta.env.DEV 
  ? (import.meta.env.VITE_API_URL || '')  // Development: use env var or empty for Vite proxy
  : (import.meta.env.VITE_API_URL || 'https://optlisting-production.up.railway.app')  // Production: Direct Railway URL

// Create Axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000,  // 60 seconds timeout (to handle API response timeouts)
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request Interceptor: Automatically add JWT token to all requests
apiClient.interceptors.request.use(
  async (config) => {
    try {
      // Get access_token from Supabase session
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session?.access_token) {
        // Add Bearer token to Authorization header
        config.headers.Authorization = `Bearer ${session.access_token}`
      } else {
        // Some endpoints may not require authentication, so we don't redirect here
        console.warn('No Auth Token found for apiClient')
      }
    } catch (error) {
      console.error('❌ [API] Failed to get session for request:', error)
      // Continue with request even if error occurs (some endpoints may not require auth)
    }
    
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response Interceptor: Attempt session refresh on 401 errors
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    // If 401 error and not yet retried
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      try {
        // Attempt to refresh session
        const { data: { session } } = await supabase.auth.refreshSession()
        
        if (session?.access_token) {
          // Retry original request with new token
          originalRequest.headers.Authorization = `Bearer ${session.access_token}`
          return apiClient(originalRequest)
        }
      } catch (refreshError) {
        console.error('❌ [API] Session refresh failed:', refreshError)
        // Could redirect to login page on refresh failure
      }
    }

    return Promise.reject(error)
  }
)

export default apiClient
export { API_BASE_URL }
