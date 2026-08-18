import React from 'react'
import { useSearchParams } from 'react-router-dom'
import DashboardLayout from './DashboardLayout'
import LowPerformingResults from './LowPerformingResults'

function ListingsPage() {
  const [searchParams] = useSearchParams()
  const mode = searchParams.get('mode') || 'all' // 'all' or 'low'
  
  return (
    <DashboardLayout>
      <LowPerformingResults mode={mode} />
    </DashboardLayout>
  )
}

export default ListingsPage

