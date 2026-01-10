import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { StoreProvider } from './contexts/StoreContext'
import { AuthProvider } from './contexts/AuthContext'
import { AccountProvider } from './contexts/AccountContext'
import LandingPage from './components/LandingPage'
import DashboardPage from './components/DashboardPage'
import ListingsPage from './components/ListingsPage'
import SettingsPage from './components/SettingsPage'
import LoginPage from './components/LoginPage'
import SignupPage from './components/SignupPage'
import TermsOfService from './components/TermsOfService'
import PrivacyPolicy from './components/PrivacyPolicy'
import Pricing from './components/Pricing'
import PaymentSuccess from './components/PaymentSuccess'
import ProtectedRoute from './components/ProtectedRoute'

function App() {
  // Apply dark mode class to root element and set page title
  React.useEffect(() => {
    document.documentElement.classList.add('dark')
    document.title = 'OptListing'
  }, [])

  return (
    <AuthProvider>
      <StoreProvider>
        <AccountProvider>
          <Router>
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/terms" element={<TermsOfService />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/payment/success" element={<PaymentSuccess />} />
              
              {/* Protected Routes */}
              <Route 
                path="/dashboard" 
                element={
                  <ProtectedRoute>
                    <DashboardPage />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/listings" 
                element={
                  <ProtectedRoute>
                    <ListingsPage />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/settings" 
                element={
                  <ProtectedRoute>
                    <SettingsPage />
                  </ProtectedRoute>
                } 
              />
            </Routes>
          </Router>
        </AccountProvider>
      </StoreProvider>
    </AuthProvider>
  )
}

export default App
