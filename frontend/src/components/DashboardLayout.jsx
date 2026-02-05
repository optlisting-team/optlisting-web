import PageHeader from './PageHeader'

function DashboardLayout({ children }) {
  return (
    <div className="flex min-h-screen bg-black font-sans">
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none">
        {/* Gradient Orbs */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl" />
        
        {/* Grid Pattern */}
        <div 
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
            `,
            backgroundSize: '64px 64px'
          }}
        />
        
        {/* Noise Texture */}
        <div 
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%' height='100%' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }}
        />
      </div>
      
      {/* Main Content Area - Full Width */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Page Header - Sticky */}
        <PageHeader />
        
        {/* Main Content - Scrollable */}
        <main className="flex-1 overflow-y-auto">
          <div className="relative z-10">
            {children}
          </div>
        </main>
        
        {/* Footer */}
        <footer className="border-t border-zinc-800/50 py-4 px-6 bg-zinc-950/50 backdrop-blur-sm">
          <div className="flex items-center justify-between text-xs text-zinc-600">
            <div className="flex items-center gap-4">
              <span>© 2024 OptListing</span>
              <span>•</span>
              <a href="#" className="hover:text-zinc-400 transition-colors">Terms</a>
              <a href="#" className="hover:text-zinc-400 transition-colors">Privacy</a>
              <a href="#" className="hover:text-zinc-400 transition-colors">Help</a>
            </div>
            <div className="flex items-center gap-2">
              <span className="data-value">v{__APP_VERSION__ || '1.1.73'}</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                All systems operational
              </span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}

export default DashboardLayout
