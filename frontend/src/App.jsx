import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { StoreProvider } from './contexts/StoreContext'
import LandingPage from './components/LandingPage'
import DashboardPage from './components/DashboardPage'
import SettingsPage from './components/SettingsPage'

function App() {
  // Apply dark mode class to root element
  React.useEffect(() => {
    document.documentElement.classList.add('dark')
  }, [])

  return (
    <StoreProvider>
      <Router>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </Router>
    </StoreProvider>
  )
}

export default App

