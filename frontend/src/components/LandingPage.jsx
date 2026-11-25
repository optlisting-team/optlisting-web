import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart3, Check, ChevronDown, LogOut, Settings, Users } from 'lucide-react'
import BrandLogo from './BrandLogo'
import { useAuth } from '../contexts/AuthContext'
import { generateProfessionalCheckoutUrl } from '../lib/checkout'

const proFeatures = [
  'Inventory Dashboard',
  'Performance Analytics',
  'Dead Stock Detection',
  'Cleanup Recommendations',
  'Up to 30,000 Listings',
]

const sampleRows = [
  { title: 'Wireless Keyboard', impressions: '1,284', views: 5, watchers: 2, sales: 0, days: 90 },
  { title: 'USB-C Charging Hub', impressions: '946', views: 4, watchers: 1, sales: 0, days: 76 },
  { title: 'LED Desk Lamp', impressions: '812', views: 3, watchers: 0, sales: 0, days: 64 },
]

function ProductPreview() {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_70px_-36px_rgba(13,27,61,0.35)]">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2 text-sm font-semibold text-brand-navy">
          <BarChart3 className="h-4 w-4 text-brand-mint" /> Inventory Optimizer
        </div>
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">90-DAY ANALYSIS</span>
      </div>
      <div className="grid gap-3 border-b border-slate-200 p-4 sm:grid-cols-4 sm:p-6">
        {[
          ['Impressions', '3,042'], ['Views', '12'], ['Watchers', '3'], ['Sales', '0'],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
            <p className="data-value mt-2 text-2xl text-brand-navy">{value}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 border-b border-slate-200 bg-slate-50/70 px-4 py-3 sm:px-6">
        {['Views up to 5', 'Watchers up to 2', 'Sales: 0'].map((filter) => (
          <span key={filter} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600">{filter}</span>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="bg-white text-xs uppercase tracking-wider text-slate-500">
            <tr>{['Listing', 'Impressions', 'Views', 'Watchers', 'Sales', 'Days', 'Status'].map((item) => <th key={item} className="px-4 py-3 font-semibold">{item}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sampleRows.map((row) => (
              <tr key={row.title} className="text-slate-600">
                <td className="px-4 py-3 font-semibold text-brand-navy">{row.title}</td>
                <td className="data-value px-4 py-3">{row.impressions}</td>
                <td className="data-value px-4 py-3">{row.views}</td>
                <td className="data-value px-4 py-3">{row.watchers}</td>
                <td className="data-value px-4 py-3">{row.sales}</td>
                <td className="data-value px-4 py-3">{row.days}</td>
                <td className="px-4 py-3"><span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">Review</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function LandingPage() {
  const { user, isAuthenticated, signOut } = useAuth()
  const [profileOpen, setProfileOpen] = useState(false)
  const checkoutUrl = user ? generateProfessionalCheckoutUrl(user) : null

  return (
    <div className="min-h-screen overflow-x-hidden bg-white text-brand-navy">
      <nav className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-6 sm:px-6 lg:px-8">
          <BrandLogo to="/" size="md" tone="dark" />
          <div className="hidden items-center gap-7 md:flex">
            <a href="#product" className="text-sm font-semibold text-slate-600 hover:text-brand-navy">Product</a>
            <a href="#how" className="text-sm font-semibold text-slate-600 hover:text-brand-navy">How it works</a>
            <a href="#pricing" className="text-sm font-semibold text-slate-600 hover:text-brand-navy">Pricing</a>
          </div>
          {isAuthenticated ? (
            <div className="relative">
              <button onClick={() => setProfileOpen(!profileOpen)} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-brand-navy hover:bg-slate-50">
                <Users className="h-4 w-4" /><span className="hidden sm:inline">{user?.email?.split('@')[0] || 'Account'}</span><ChevronDown className="h-4 w-4" />
              </button>
              {profileOpen && (
                <div className="absolute right-0 mt-2 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                  <Link to="/dashboard" className="flex items-center gap-2 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50"><BarChart3 className="h-4 w-4" />Dashboard</Link>
                  <Link to="/settings" className="flex items-center gap-2 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50"><Settings className="h-4 w-4" />Settings</Link>
                  <button onClick={signOut} className="flex w-full items-center gap-2 border-t border-slate-100 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50"><LogOut className="h-4 w-4" />Sign out</button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 sm:gap-3">
              <Link to="/login" className="text-sm font-semibold text-slate-600 hover:text-brand-navy">Sign in</Link>
              <Link to="/signup" className="rounded-lg bg-brand-navy px-4 py-2.5 text-sm font-bold text-white hover:bg-[#162957]">Start free trial</Link>
            </div>
          )}
        </div>
      </nav>

      <main>
        <section className="border-b border-slate-100 bg-gradient-to-b from-[#F7F9FC] to-white px-4 pb-16 pt-16 sm:px-6 sm:pb-24 sm:pt-24 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-4xl text-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-brand-navy"><span className="h-2 w-2 rounded-full bg-brand-mint" />eBay Inventory Optimizer</span>
              <h1 className="mt-6 text-4xl font-extrabold leading-tight tracking-[-0.04em] text-brand-navy sm:text-5xl lg:text-6xl">Find What Doesn't Sell.</h1>
              <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-600 sm:text-xl">Analyze. Find. Clean.</p>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <Link to="/signup" className="rounded-lg bg-brand-navy px-6 py-3.5 text-sm font-bold text-white hover:bg-[#162957]">Start Free Trial</Link>
                <a href="#how" className="rounded-lg border border-slate-300 bg-white px-6 py-3.5 text-sm font-bold text-brand-navy hover:border-brand-navy">See How It Works</a>
              </div>
              <p className="mt-4 text-sm text-slate-500">Up to 30,000 listings</p>
            </div>
            <div id="product" className="mx-auto mt-14 max-w-6xl scroll-mt-24"><ProductPreview /></div>
          </div>
        </section>

        <section id="how" className="bg-[#F7F9FC] px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl"><div className="text-center"><h2 className="text-3xl font-bold text-brand-navy sm:text-4xl">5 Steps. Done.</h2></div>
            <div className="mt-12 grid gap-5 md:grid-cols-3 lg:grid-cols-5">
              {[
                ['01', 'Connect eBay'],
                ['02', 'Auto-Classify Listings'],
                ['03', 'Copy Title in Deleting Box'],
                ['04', 'Paste & Delete at Supplier'],
                ['05', 'Synced Automatically Next Scan'],
              ].map(([number, title]) => <div key={number} className="rounded-xl border border-slate-200 bg-white p-6"><span className="data-value text-sm font-bold text-emerald-600">{number}</span><h3 className="mt-4 text-xl font-bold text-brand-navy">{title}</h3></div>)}
            </div>
          </div>
        </section>

        <section id="pricing" className="px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-5xl">
            <div className="text-center"><h2 className="text-3xl font-bold text-brand-navy sm:text-4xl">Simple Pricing.</h2><p className="mt-4 text-lg text-slate-600">7 days free.</p></div>
            <div className="mx-auto mt-10 max-w-2xl rounded-2xl border-2 border-brand-navy bg-white p-6 shadow-[0_18px_50px_-34px_rgba(13,27,61,0.35)] sm:p-9">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><h3 className="text-2xl font-bold text-brand-navy">Pro</h3></div><div className="sm:text-right"><span className="data-value text-5xl font-bold text-brand-navy">$49</span><span className="text-slate-500">/month</span></div></div>
              <ul className="mt-8 grid gap-4 sm:grid-cols-2">{proFeatures.map((feature) => <li key={feature} className="flex gap-3 text-sm leading-6 text-slate-700"><span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50"><Check className="h-3.5 w-3.5 text-emerald-600" /></span>{feature}</li>)}</ul>
              {isAuthenticated && checkoutUrl ? <a href={checkoutUrl} target="_blank" rel="noopener noreferrer" className="mt-8 block w-full rounded-lg bg-brand-navy px-6 py-3.5 text-center text-sm font-bold text-white hover:bg-[#162957]">Start Free Trial</a> : <Link to="/signup" className="mt-8 block w-full rounded-lg bg-brand-navy px-6 py-3.5 text-center text-sm font-bold text-white hover:bg-[#162957]">Start Free Trial</Link>}
            </div>
            <div className="mt-6 flex flex-col items-start justify-between gap-5 rounded-xl border border-slate-200 bg-[#F7F9FC] p-6 sm:flex-row sm:items-center"><div><h3 className="font-bold text-brand-navy">30,000+ listings?</h3></div><a href="mailto:support@optlisting.com?subject=Enterprise%20Access" className="shrink-0 rounded-lg border border-brand-navy bg-white px-5 py-3 text-sm font-bold text-brand-navy hover:bg-blue-50">Request Enterprise Access</a></div>
          </div>
        </section>
      </main>

      <footer className="bg-brand-navy px-4 py-12 text-white sm:px-6 lg:px-8"><div className="mx-auto flex max-w-7xl flex-col gap-8 sm:flex-row sm:items-center sm:justify-between"><div><BrandLogo to="/" size="md" /><p className="mt-3 text-sm text-slate-300">Find what doesn't sell.</p></div><div className="flex gap-6 text-sm text-slate-300"><Link to="/pricing" className="hover:text-white">Pricing</Link><Link to="/terms" className="hover:text-white">Terms</Link><Link to="/privacy" className="hover:text-white">Privacy</Link></div></div></footer>
    </div>
  )
}

export default LandingPage
