import PageHeader from './PageHeader'

function DashboardLayout({ children }) {
  return (
    <div className="flex min-h-screen bg-[#F7F9FC] font-sans text-brand-navy">
      <div className="flex min-w-0 flex-1 flex-col">
        <PageHeader />
        <main className="flex-1 overflow-y-auto">{children}</main>
        <footer className="border-t border-slate-200 bg-white px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <span>© 2026 Optlisting</span>
              <a href="/terms" className="transition-colors hover:text-brand-navy">Terms</a>
              <a href="/privacy" className="transition-colors hover:text-brand-navy">Privacy</a>
            </div>
            <div className="flex items-center gap-3">
              <span className="data-value">v{__APP_VERSION__ || '1.3.7'}</span>
              <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-brand-mint" />All systems operational</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}

export default DashboardLayout
