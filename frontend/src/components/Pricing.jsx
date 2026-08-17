import { Check } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useAccount } from '../contexts/AccountContext'
import { generateProfessionalCheckoutUrl } from '../lib/checkout'
import BrandLogo from './BrandLogo'

const features = [
  'Full Inventory Diagnostic Dashboard',
  'Analytics: Views, Impressions, Watchers & Sales',
  'Dead stock detection & cleanup recommendations',
  'Up to 30,000 active listings',
]

export default function Pricing() {
  const { user } = useAuth()
  const { subscriptionStatus, plan } = useAccount()
  const checkoutUrl = user ? generateProfessionalCheckoutUrl(user) : null
  const hasProPlan = subscriptionStatus === 'active' && plan === 'PROFESSIONAL'

  return (
    <div className="min-h-screen bg-[#F7F9FC] text-brand-navy">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <BrandLogo to="/" size="sm" tone="dark" />
          <a href="mailto:support@optlisting.com" className="text-sm font-semibold text-slate-600 hover:text-brand-navy">Contact support</a>
        </div>
      </header>
      <main className="px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <p className="text-sm font-bold uppercase tracking-widest text-emerald-600">Simple pricing</p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-brand-navy sm:text-5xl">Optimize your inventory with confidence.</h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-600">See listing performance clearly, find dead stock, and prioritize cleanup across up to 30,000 active eBay listings.</p>
          </div>

          <section className="mx-auto mt-12 max-w-2xl rounded-2xl border-2 border-brand-navy bg-white p-6 shadow-[0_18px_50px_-34px_rgba(13,27,61,0.35)] sm:p-10">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
              <div><span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-brand-navy">7-Day Free Trial Included</span><h2 className="mt-5 text-3xl font-bold text-brand-navy">Pro</h2><p className="mt-2 text-slate-600">For professional eBay sellers</p></div>
              <div className="sm:text-right"><span className="data-value text-5xl font-bold text-brand-navy">$49</span><span className="text-slate-500">/month</span></div>
            </div>
            <div className="my-8 h-px bg-slate-200" />
            <ul className="space-y-4">{features.map((feature) => <li key={feature} className="flex gap-3 text-slate-700"><span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-50"><Check className="h-4 w-4 text-emerald-600" /></span>{feature}</li>)}</ul>
            {hasProPlan ? (
              <div className="mt-8 rounded-lg bg-emerald-50 px-6 py-4 text-center font-bold text-emerald-700">Your Pro plan is active</div>
            ) : user && checkoutUrl ? (
              <a href={checkoutUrl} target="_blank" rel="noopener noreferrer" className="mt-8 block rounded-lg bg-brand-navy px-6 py-4 text-center font-bold text-white hover:bg-[#162957]">Start 7-day free trial</a>
            ) : (
              <a href="/signup" className="mt-8 block rounded-lg bg-brand-navy px-6 py-4 text-center font-bold text-white hover:bg-[#162957]">Sign up to start your trial</a>
            )}
          </section>

          <section className="mx-auto mt-6 flex max-w-2xl flex-col gap-5 rounded-xl border border-slate-200 bg-white p-6 sm:flex-row sm:items-center sm:justify-between">
            <div><h2 className="font-bold text-brand-navy">Managing more than 30,000 listings?</h2><p className="mt-1 text-sm text-slate-600">Request a setup tailored to your operation.</p></div>
            <a href="mailto:support@optlisting.com?subject=Enterprise%20Access" className="shrink-0 rounded-lg border border-brand-navy px-5 py-3 text-center text-sm font-bold text-brand-navy hover:bg-blue-50">Request Enterprise Access</a>
          </section>
        </div>
      </main>
    </div>
  )
}
