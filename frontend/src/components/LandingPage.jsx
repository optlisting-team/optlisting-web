import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart3, Check, ChevronDown, LineChart, LogOut, Settings, Target, TrendingUp, Users } from 'lucide-react'
import BrandLogo from './BrandLogo'
import { useAuth } from '../contexts/AuthContext'
import { generateProfessionalCheckoutUrl } from '../lib/checkout'

const proFeatures = [
  'Full Inventory Diagnostic Dashboard',
  'Analytics: Views, Impressions, Watchers & Sales',
  'Dead stock detection & cleanup recommendations',
  'Up to 30,000 active listings',
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
        <span className="ml-auto text-xs text-slate-500">Example thresholds - fully configurable</span>
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
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <BrandLogo to="/" size="sm" tone="dark" />
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
              <Link to="/login" className="hidden text-sm font-semibold text-slate-600 hover:text-brand-navy sm:block">Sign in</Link>
              <Link to="/signup" className="rounded-lg bg-brand-navy px-4 py-2.5 text-sm font-bold text-white hover:bg-[#162957]">Start free trial</Link>
            </div>
          )}
        </div>
      </nav>

      <main>
        <section className="border-b border-slate-100 bg-gradient-to-b from-[#F7F9FC] to-white px-4 pb-16 pt-16 sm:px-6 sm:pb-24 sm:pt-24 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-4xl text-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-brand-navy"><span className="h-2 w-2 rounded-full bg-brand-mint" />eBay inventory optimization</span>
              <h1 className="mt-6 text-4xl font-extrabold leading-tight tracking-[-0.04em] text-brand-navy sm:text-5xl lg:text-6xl">Make every listing earn its place.</h1>
              <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-600 sm:text-xl">Understand listing performance, detect dead stock, and act on clear cleanup recommendations using your latest 90 days of eBay data.</p>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <Link to="/signup" className="rounded-lg bg-brand-navy px-6 py-3.5 text-sm font-bold text-white hover:bg-[#162957]">Start 7-day free trial</Link>
                <a href="#product" className="rounded-lg border border-slate-300 bg-white px-6 py-3.5 text-sm font-bold text-brand-navy hover:border-brand-navy">See the optimizer</a>
              </div>
              <p className="mt-4 text-sm text-slate-500">Built for professional eBay sellers - Up to 30,000 active listings</p>
            </div>
            <div id="product" className="mx-auto mt-14 max-w-6xl scroll-mt-24"><ProductPreview /></div>
          </div>
        </section>

        <section className="px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-2xl"><p className="text-sm font-bold uppercase tracking-widest text-emerald-600">One operational view</p><h2 className="mt-3 text-3xl font-bold tracking-tight text-brand-navy sm:text-4xl">Know what is working and what needs attention.</h2><p className="mt-4 text-lg text-slate-600">Move from scattered marketplace data to focused inventory decisions.</p></div>
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {[
                [LineChart, 'Listing performance analytics', 'Review impressions, views, watchers, sales, and listing age in one precise workspace.'],
                [Target, 'Dead stock detection', 'Set your own performance thresholds and identify listings that deserve review.'],
                [TrendingUp, 'Cleanup recommendations', 'Prioritize action with clear, data-informed recommendations you control.'],
              ].map(([Icon, title, body]) => (
                <article key={title} className="rounded-xl border border-slate-200 bg-white p-6 shadow-[0_8px_30px_-24px_rgba(13,27,61,0.3)]">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-brand-navy"><Icon className="h-5 w-5" /></div>
                  <h3 className="mt-5 text-xl font-bold text-brand-navy">{title}</h3><p className="mt-3 leading-7 text-slate-600">{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="how" className="bg-[#F7F9FC] px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl"><div className="text-center"><h2 className="text-3xl font-bold text-brand-navy sm:text-4xl">From inventory data to focused action</h2></div>
            <div className="mt-12 grid gap-5 md:grid-cols-3">
              {[
                ['01', 'Connect your store', 'Bring your eBay inventory into a secure operational view.'],
                ['02', 'Define performance criteria', 'Use configurable Views, Watchers, and Sales thresholds for your workflow.'],
                ['03', 'Review recommendations', 'See which listings need attention and decide the right cleanup action.'],
              ].map(([number, title, body]) => <div key={number} className="rounded-xl border border-slate-200 bg-white p-6"><span className="data-value text-sm font-bold text-emerald-600">{number}</span><h3 className="mt-4 text-xl font-bold text-brand-navy">{title}</h3><p className="mt-3 leading-7 text-slate-600">{body}</p></div>)}
            </div>
          </div>
        </section>

        <section id="pricing" className="px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-5xl">
            <div className="text-center"><h2 className="text-3xl font-bold text-brand-navy sm:text-4xl">Straightforward pricing for serious sellers</h2><p className="mt-4 text-lg text-slate-600">Start with a 7-day free trial.</p></div>
            <div className="mx-auto mt-10 max-w-2xl rounded-2xl border-2 border-brand-navy bg-white p-6 shadow-[0_18px_50px_-34px_rgba(13,27,61,0.35)] sm:p-9">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand-navy">7-Day Free Trial Included</span><h3 className="mt-5 text-2xl font-bold text-brand-navy">Pro</h3></div><div className="sm:text-right"><span className="data-value text-5xl font-bold text-brand-navy">$49</span><span className="text-slate-500">/month</span></div></div>
              <ul className="mt-8 grid gap-4 sm:grid-cols-2">{proFeatures.map((feature) => <li key={feature} className="flex gap-3 text-sm leading-6 text-slate-700"><span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50"><Check className="h-3.5 w-3.5 text-emerald-600" /></span>{feature}</li>)}</ul>
              {isAuthenticated && checkoutUrl ? <a href={checkoutUrl} target="_blank" rel="noopener noreferrer" className="mt-8 block w-full rounded-lg bg-brand-navy px-6 py-3.5 text-center text-sm font-bold text-white hover:bg-[#162957]">Start free trial</a> : <Link to="/signup" className="mt-8 block w-full rounded-lg bg-brand-navy px-6 py-3.5 text-center text-sm font-bold text-white hover:bg-[#162957]">Start free trial</Link>}
            </div>
            <div className="mt-6 flex flex-col items-start justify-between gap-5 rounded-xl border border-slate-200 bg-[#F7F9FC] p-6 sm:flex-row sm:items-center"><div><h3 className="font-bold text-brand-navy">Managing more than 30,000 listings?</h3><p className="mt-1 text-sm text-slate-600">Talk with us about the right setup for your operation.</p></div><a href="mailto:support@optlisting.com?subject=Enterprise%20Access" className="shrink-0 rounded-lg border border-brand-navy bg-white px-5 py-3 text-sm font-bold text-brand-navy hover:bg-blue-50">Request Enterprise Access</a></div>
          </div>
        </section>
      </main>

      <footer className="bg-brand-navy px-4 py-12 text-white sm:px-6 lg:px-8"><div className="mx-auto flex max-w-7xl flex-col gap-8 sm:flex-row sm:items-center sm:justify-between"><div><BrandLogo to="/" size="sm" /><p className="mt-3 text-sm text-slate-300">eBay inventory operations, made precise.</p></div><div className="flex gap-6 text-sm text-slate-300"><Link to="/pricing" className="hover:text-white">Pricing</Link><Link to="/terms" className="hover:text-white">Terms</Link><Link to="/privacy" className="hover:text-white">Privacy</Link></div></div></footer>
    </div>
  )
}

export default LandingPage
