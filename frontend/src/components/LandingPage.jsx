import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, TrendingDown, Ban, DollarSign, Check, CheckCircle, Zap, TrendingUp, Clock, Puzzle, Table, ChevronDown } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from './ui/card'
import { Button } from './ui/button'

// Credit Pack Options - Each is a fixed price product for PG approval
const CREDIT_PACKS = [
  { id: 'credit-5', price: 5, credits: 300, perScan: 0.017, discount: 0, label: 'Starter' },
  { id: 'credit-10', price: 10, credits: 800, perScan: 0.0125, discount: 26, label: 'Popular', popular: true },
  { id: 'credit-15', price: 15, credits: 1200, perScan: 0.0125, discount: 26, label: 'Value' },
  { id: 'credit-20', price: 20, credits: 2000, perScan: 0.01, discount: 41, label: 'Best', best: true },
  { id: 'credit-25', price: 25, credits: 2600, perScan: 0.0096, discount: 43, label: 'Pro' },
  { id: 'credit-50', price: 50, credits: 6000, perScan: 0.0083, discount: 51, label: 'Business' },
]

function LandingPage() {
  const [selectedPack, setSelectedPack] = useState(CREDIT_PACKS[1]) // Default to $10 Popular
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

  const fadeInUp = {
    initial: { opacity: 0, y: 30 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6 }
  }

  const staggerContainer = {
    animate: {
      transition: {
        staggerChildren: 0.1
      }
    }
  }

  return (
    <div className="min-h-screen bg-black dark:bg-black font-sans">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 bg-black/60 dark:bg-black/60 backdrop-blur-xl border-b border-zinc-800 dark:border-zinc-800 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg shadow-lg shadow-blue-500/20">
              <Zap className="h-6 w-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-white dark:text-white">OptListing</span>
          </div>
          <div className="flex items-center space-x-6">
            <a href="#features" className="text-zinc-300 dark:text-zinc-300 hover:text-white dark:hover:text-white font-medium transition-colors">Features</a>
            <a href="#pricing" className="text-zinc-300 dark:text-zinc-300 hover:text-white dark:hover:text-white font-medium transition-colors">Pricing</a>
            <a href="/dashboard" className="px-5 py-2 bg-white dark:bg-white hover:bg-zinc-200 dark:hover:bg-zinc-200 text-black dark:text-black font-semibold rounded-lg transition-all shadow-md">
              Get Started
            </a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-4 overflow-hidden bg-black dark:bg-black">
        {/* Background Grid Pattern - Enhanced */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f00a_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f00a_1px,transparent_1px)] bg-[size:32px_32px]"></div>
        
        {/* Radial Gradient Glow - Soft Blue/Purple Glow */}
        <div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1200px] h-[1200px] rounded-full blur-3xl pointer-events-none opacity-50"
          style={{
            background: 'radial-gradient(circle, rgba(59, 130, 246, 0.2) 0%, rgba(99, 102, 241, 0.15) 25%, rgba(37, 99, 235, 0.1) 50%, transparent 70%)'
          }}
        ></div>
        
        <div className="container mx-auto max-w-6xl relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-12"
          >
            <h1 className="text-6xl md:text-8xl font-extrabold tracking-tight mb-6 leading-tight font-sans">
              <span className="text-white dark:text-white">'Zero Sale' </span>
              <span className="text-white dark:text-white">Cleaner.</span>
            </h1>
            <h2 className="text-xl md:text-2xl text-zinc-400 dark:text-zinc-400 font-normal mb-10 max-w-3xl mx-auto leading-relaxed font-sans">
              Instantly generate a CSV of dead listings—so you can delete them fast and clean.
            </h2>
            <div className="flex flex-col items-center mt-8">
              <motion.a
                href="/dashboard"
                whileHover={{ scale: 1.05, y: -4 }}
                whileTap={{ scale: 0.95 }}
                className="px-12 py-5 bg-white dark:bg-white hover:bg-zinc-200 dark:hover:bg-zinc-200 text-black dark:text-black font-semibold text-lg rounded-xl shadow-lg transition-all hover:-translate-y-1 flex items-center gap-2 font-sans"
              >
                Start Your 30-Day Free Trial
                <ArrowRight className="h-5 w-5" />
              </motion.a>
              {/* Microcopy */}
              <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-4 text-center font-sans">
                Credit card required. Cancel anytime.
              </p>
            </div>
          </motion.div>

          {/* Dashboard Screenshot Placeholder - 3D Effect */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.3 }}
            className="mt-20"
            style={{ perspective: '1000px' }}
          >
            <div 
              className="relative transform-gpu" 
              style={{ 
                transform: 'perspective(1000px) rotateX(12deg) scale(0.95)',
                transformStyle: 'preserve-3d'
              }}
            >
              <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 dark:from-zinc-900 dark:to-zinc-800 rounded-xl p-10 border-8 border-zinc-800 dark:border-zinc-800 shadow-2xl">
                <div className="bg-zinc-900 dark:bg-zinc-900 rounded-xl p-16 border border-zinc-800 dark:border-zinc-800 min-h-[450px] flex items-center justify-center shadow-inner">
                  <div className="text-center">
                    <div className="text-7xl mb-6">📊</div>
                    <p className="text-zinc-400 dark:text-zinc-400 text-xl font-semibold">Dashboard Screenshot</p>
                    <p className="text-zinc-500 dark:text-zinc-500 text-sm mt-3">(Image will be added here)</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Social Proof / Trust Bar */}
      <section className="py-12 bg-zinc-900 dark:bg-zinc-900 border-y border-zinc-800 dark:border-zinc-800">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-8"
          >
            <p className="text-zinc-400 dark:text-zinc-400 font-medium mb-6">Compatible with your favorite tools:</p>
            <div className="flex flex-wrap justify-center items-center gap-8 md:gap-12 opacity-60 grayscale">
              <div className="text-2xl font-bold text-zinc-500 dark:text-zinc-500">eBay</div>
              <div className="text-2xl font-bold text-zinc-500 dark:text-zinc-500">Shopify</div>
              <div className="text-2xl font-bold text-zinc-500 dark:text-zinc-500">Amazon</div>
              <div className="text-2xl font-bold text-zinc-500 dark:text-zinc-500">AutoDS</div>
              <div className="text-2xl font-bold text-zinc-500 dark:text-zinc-500">Yaballe</div>
              <div className="text-2xl font-bold text-zinc-500 dark:text-zinc-500">CJ Dropshipping</div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* The "Pain" Section */}
      <section className="py-24 px-4 bg-zinc-900 dark:bg-zinc-900" id="pain">
        <div className="container mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-20"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-white dark:text-white mb-4 font-sans">
              Why Your Inventory Needs Optimization
            </h2>
            <p className="text-xl text-zinc-400 dark:text-zinc-400 max-w-2xl mx-auto font-sans">
              Dead stock isn't just taking up space—it's actively hurting your business.
            </p>
          </motion.div>

          <motion.div
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            className="grid md:grid-cols-3 gap-10"
          >
            <motion.div
              variants={fadeInUp}
              className="bg-zinc-900 dark:bg-zinc-900 p-10 rounded-2xl border border-zinc-800 dark:border-zinc-800 shadow-sm hover:shadow-md transition-all"
            >
              <div className="w-16 h-16 bg-zinc-800 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-6">
                <TrendingDown className="h-8 w-8 text-white dark:text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white dark:text-white mb-4 font-sans">Marketplace Algorithms Hate Dead Stock</h3>
              <p className="text-zinc-400 dark:text-zinc-400 text-lg leading-relaxed font-sans">
                Old, unsold items drag down your search ranking on every major platform. Clear your dead inventory before it hurts your visibility.
              </p>
            </motion.div>

            <motion.div
              variants={fadeInUp}
              className="bg-zinc-900 dark:bg-zinc-900 p-10 rounded-2xl border border-zinc-800 dark:border-zinc-800 shadow-sm hover:shadow-md transition-all"
            >
              <div className="w-16 h-16 bg-zinc-800 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-6">
                <Ban className="h-8 w-8 text-white dark:text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white dark:text-white mb-4 font-sans">Make Room for Winners</h3>
              <p className="text-zinc-400 dark:text-zinc-400 text-lg leading-relaxed font-sans">
                Most marketplaces limit your listing slots. Remove dead stock so you can fill those slots with items that actually sell.
              </p>
            </motion.div>

            <motion.div
              variants={fadeInUp}
              className="bg-zinc-900 dark:bg-zinc-900 p-10 rounded-2xl border border-zinc-800 dark:border-zinc-800 shadow-sm hover:shadow-md transition-all"
            >
              <div className="w-16 h-16 bg-zinc-800 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-6">
                <DollarSign className="h-8 w-8 text-white dark:text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white dark:text-white mb-4 font-sans">Cut 90% of Your Cleanup Time</h3>
              <p className="text-zinc-400 dark:text-zinc-400 text-lg leading-relaxed font-sans">
                Stop deleting listings one by one. Automate the entire process instantly.
              </p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-24 px-4 bg-zinc-900 dark:bg-zinc-900" id="features">
        <div className="container mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-20"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-white dark:text-white mb-4 font-sans">
              How It Works
            </h2>
            <p className="text-xl text-zinc-400 dark:text-zinc-400 max-w-2xl mx-auto font-sans">
              Three simple steps to clean up your inventory
            </p>
          </motion.div>

          <motion.div
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            className="grid md:grid-cols-3 gap-10"
          >
            <motion.div
              variants={fadeInUp}
              className="bg-zinc-900 dark:bg-zinc-900 p-10 rounded-2xl border border-zinc-800 dark:border-zinc-800 shadow-sm hover:shadow-md transition-all"
            >
              <div className="w-16 h-16 bg-zinc-800 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-6">
                <span className="text-3xl font-bold text-white dark:text-white font-sans">1</span>
              </div>
              <h3 className="text-2xl font-bold text-white dark:text-white mb-4 font-sans">Connect Your Store</h3>
              <p className="text-zinc-400 dark:text-zinc-400 text-lg leading-relaxed font-sans">
                Securely link your marketplace account.
              </p>
            </motion.div>

            <motion.div
              variants={fadeInUp}
              className="bg-zinc-900 dark:bg-zinc-900 p-10 rounded-2xl border border-zinc-800 dark:border-zinc-800 shadow-sm hover:shadow-md transition-all"
            >
              <div className="w-16 h-16 bg-zinc-800 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-6">
                <span className="text-3xl font-bold text-white dark:text-white font-sans">2</span>
              </div>
              <h3 className="text-2xl font-bold text-white dark:text-white mb-4 font-sans">Detect Low-Interest Items</h3>
              <p className="text-zinc-400 dark:text-zinc-400 text-lg leading-relaxed font-sans">
                We analyze your listings and flag dead stock, low impressions, and non-performers.
              </p>
            </motion.div>

            <motion.div
              variants={fadeInUp}
              className="bg-zinc-900 dark:bg-zinc-900 p-10 rounded-2xl border border-zinc-800 dark:border-zinc-800 shadow-sm hover:shadow-md transition-all"
            >
              <div className="w-16 h-16 bg-zinc-800 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-6">
                <span className="text-3xl font-bold text-white dark:text-white font-sans">3</span>
              </div>
              <h3 className="text-2xl font-bold text-white dark:text-white mb-4 font-sans">Download & Delete via CSV</h3>
              <p className="text-zinc-400 dark:text-zinc-400 text-lg leading-relaxed font-sans">
                Export a ready-to-upload CSV, then bulk-delete inside your marketplace.
              </p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 px-4 bg-black dark:bg-black" id="features-benefits">
        <div className="container mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-20"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-white dark:text-white mb-4 font-sans">
              Features
            </h2>
          </motion.div>

          <motion.div
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            className="grid md:grid-cols-3 gap-10"
          >
            <motion.div
              variants={fadeInUp}
              className="bg-zinc-900 dark:bg-zinc-900 p-10 rounded-2xl border border-zinc-800 dark:border-zinc-800 shadow-sm hover:shadow-md transition-all"
            >
              <div className="w-16 h-16 bg-zinc-800 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-6">
                <TrendingUp className="h-8 w-8 text-white dark:text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white dark:text-white mb-4 font-sans">Boost Your Store Performance</h3>
              <p className="text-zinc-400 dark:text-zinc-400 text-lg leading-relaxed font-sans">
                Removing dead inventory improves search visibility across all major marketplaces.
              </p>
            </motion.div>

            <motion.div
              variants={fadeInUp}
              className="bg-zinc-900 dark:bg-zinc-900 p-10 rounded-2xl border border-zinc-800 dark:border-zinc-800 shadow-sm hover:shadow-md transition-all"
            >
              <div className="w-16 h-16 bg-zinc-800 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-6">
                <Clock className="h-8 w-8 text-white dark:text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white dark:text-white mb-4 font-sans">CSV-Ready Cleanup</h3>
              <p className="text-zinc-400 dark:text-zinc-400 text-lg leading-relaxed font-sans">
                Stay fully in control. We generate a clean, deletion-ready CSV for safe bulk removal.
              </p>
            </motion.div>

            <motion.div
              variants={fadeInUp}
              className="bg-zinc-900 dark:bg-zinc-900 p-10 rounded-2xl border border-zinc-800 dark:border-zinc-800 shadow-sm hover:shadow-md transition-all"
            >
              <div className="w-16 h-16 bg-zinc-800 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-6">
                <Puzzle className="h-8 w-8 text-white dark:text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white dark:text-white mb-4 font-sans">Seamless Across Markets & Suppliers</h3>
              <p className="text-zinc-400 dark:text-zinc-400 text-lg leading-relaxed font-sans">
                Built to fit any seller workflow. Supports multiple marketplaces and suppliers, with more added regularly.
              </p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Pricing Section - Vertical Separation UX */}
      <section className="py-24 px-4 bg-zinc-900 dark:bg-zinc-900 relative overflow-hidden" id="pricing">
        {/* Background Gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-900 via-zinc-900 to-black pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="container mx-auto max-w-6xl relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            {/* Header */}
            <div className="text-center mb-8">
              <motion.span 
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-sm font-semibold mb-6"
              >
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                Hybrid Pricing
              </motion.span>
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
                1 Hour → 5 Minutes
              </h2>
              <p className="text-xl text-zinc-400 max-w-2xl mx-auto">
                Master Your Time, Dominate the Market.
              </p>
            </div>

            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* P1: Credit Pack Section (Pay-Per-Scan) - Volume Discount */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="mb-16"
            >
              {/* Section Header - Centered */}
              <div className="text-center mb-6">
                <div className="inline-flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center">
                    <span className="text-xl">💰</span>
                  </div>
                  <h3 className="text-xl font-bold text-white">Credit Packs</h3>
                </div>
                <p className="text-zinc-400 text-sm">One-time purchase • No commitment • Volume discounts</p>
                <p className="text-blue-400 text-xs mt-1">💡 For occasional users who prefer no subscriptions</p>
              </div>

              {/* Credit Pack Selector - Compact */}
              <div className="max-w-md mx-auto">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.25 }}
                  className="relative bg-gradient-to-b from-amber-500/10 to-zinc-800/80 border-2 border-amber-500/40 rounded-2xl p-6 shadow-xl shadow-amber-500/10"
                >
                  {/* Selected Pack Badge */}
                  {selectedPack.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="px-4 py-1 bg-gradient-to-r from-amber-600 to-orange-500 text-white text-xs font-bold rounded-full shadow-lg shadow-amber-500/30">
                        🔥 MOST POPULAR
                      </span>
                    </div>
                  )}
                  {selectedPack.best && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="px-4 py-1 bg-gradient-to-r from-orange-600 to-amber-500 text-white text-xs font-bold rounded-full shadow-lg shadow-orange-500/30">
                        💎 BEST VALUE
                      </span>
                    </div>
                  )}

                  {/* Dropdown Selector */}
                  <div className="mb-6 mt-2">
                    <label className="block text-zinc-400 text-sm mb-2 font-medium">Select Your Credit Pack</label>
                    <div className="relative">
                      <button
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        className="w-full flex items-center justify-between px-5 py-4 bg-zinc-900/80 border-2 border-amber-500/30 rounded-xl text-white font-bold text-lg hover:border-amber-500/50 transition-all"
                      >
                        <span className="flex items-center gap-3">
                          <span className="text-2xl font-black text-amber-400">${selectedPack.price}</span>
                          <span className="text-zinc-400">—</span>
                          <span>{selectedPack.credits.toLocaleString()} Credits</span>
                          {selectedPack.discount > 0 && (
                            <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs font-bold rounded-full">
                              {selectedPack.discount}% OFF
                            </span>
                          )}
                        </span>
                        <ChevronDown className={`w-5 h-5 text-zinc-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>

                      {/* Dropdown Menu */}
                      {isDropdownOpen && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl shadow-black/50 z-50 overflow-hidden">
                          {CREDIT_PACKS.map((pack) => (
                            <button
                              key={pack.id}
                              onClick={() => {
                                setSelectedPack(pack)
                                setIsDropdownOpen(false)
                              }}
                              className={`w-full flex items-center justify-between px-5 py-4 hover:bg-amber-500/10 transition-all border-b border-zinc-800 last:border-b-0 ${
                                selectedPack.id === pack.id ? 'bg-amber-500/15' : ''
                              }`}
                            >
                              <span className="flex items-center gap-3">
                                <span className="text-xl font-black text-amber-400">${pack.price}</span>
                                <span className="text-zinc-500">—</span>
                                <span className="text-white font-medium">{pack.credits.toLocaleString()} Credits</span>
                              </span>
                              <span className="flex items-center gap-2">
                                {pack.discount > 0 && (
                                  <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs font-bold rounded-full">
                                    {pack.discount}% OFF
                                  </span>
                                )}
                                {pack.popular && <span className="text-amber-400 text-xs">⭐</span>}
                                {pack.best && <span className="text-orange-400 text-xs">💎</span>}
                                {selectedPack.id === pack.id && <Check className="w-4 h-4 text-emerald-400" />}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Selected Pack Details */}
                  <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl mb-4">
                    <div className="text-center mb-2">
                      <span className="text-4xl font-black text-white">{selectedPack.credits.toLocaleString()}</span>
                      <span className="text-xl text-zinc-400 ml-2">Credits</span>
                    </div>
                    <div className="flex items-center justify-center gap-3 text-sm">
                      <span className="text-zinc-400">
                        <span className="text-white font-bold">${selectedPack.perScan}</span> per scan
                      </span>
                      {selectedPack.discount > 0 && (
                        <span className="text-emerald-400 font-bold">
                          Save {selectedPack.discount}%
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Features - Compact */}
                  <div className="flex flex-wrap gap-2 mb-4 justify-center text-xs">
                    <span className="flex items-center gap-1 px-2 py-1 bg-zinc-800 rounded-lg">
                      <Check className="w-3 h-3 text-amber-400" />
                      <span className="text-zinc-300">{selectedPack.credits.toLocaleString()} Scans</span>
                    </span>
                    <span className="flex items-center gap-1 px-2 py-1 bg-zinc-800 rounded-lg">
                      <Check className="w-3 h-3 text-amber-400" />
                      <span className="text-zinc-300">All Stores</span>
                    </span>
                    <span className="flex items-center gap-1 px-2 py-1 bg-emerald-500/20 rounded-lg">
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-300 font-semibold">Never Expires ✨</span>
                    </span>
                  </div>

                  {/* Purchase Button */}
                  <a
                    href={`https://optlisting.lemonsqueezy.com/checkout/${selectedPack.id}`}
                    className="block w-full py-3 bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-500 hover:to-orange-400 text-white font-bold rounded-xl text-center transition-all shadow-lg shadow-amber-500/30 hover:shadow-amber-500/50"
                  >
                    Get {selectedPack.credits.toLocaleString()} Credits — ${selectedPack.price}
                  </a>

                  {/* Quick Select Buttons */}
                  <div className="mt-4 pt-3 border-t border-zinc-700/50">
                    <div className="flex gap-1.5 justify-center flex-wrap">
                      {CREDIT_PACKS.map((pack) => (
                        <button
                          key={pack.id}
                          onClick={() => setSelectedPack(pack)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            selectedPack.id === pack.id
                              ? 'bg-amber-500 text-black'
                              : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white'
                          }`}
                        >
                          ${pack.price}
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Credit Pack Footer Info */}
              <div className="mt-6 text-center">
                <p className="text-zinc-500 text-sm">
                  <span className="text-amber-400">1 Credit = 1 Listing Scan</span> • 
                  <span className="text-blue-400 font-semibold">All Stores</span> • 
                  <span className="text-emerald-400 font-semibold">Never Expires</span>
                </p>
              </div>
            </motion.div>

            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* P2: Subscription Plans Section - Main Products */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
            >
              {/* Section Header */}
              {/* Section Header - Centered */}
              <div className="text-center mb-6">
                <div className="inline-flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
                    <span className="text-xl">🏆</span>
                  </div>
                  <h3 className="text-xl font-bold text-white">Subscription Plans</h3>
                </div>
                <p className="text-zinc-400 text-sm">Monthly billing • Cancel anytime • Unlimited scans</p>
                <p className="text-emerald-400 text-xs mt-1">🔄 For power sellers who need continuous listing management</p>
              </div>

              {/* Subscription Cards - 3 Column */}
              <div className="grid md:grid-cols-3 gap-4 max-w-4xl mx-auto">
                
                {/* BASIC Plan - $19 */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.32 }}
                  className="relative bg-zinc-800/50 border border-zinc-700 rounded-2xl p-6 hover:border-cyan-500/30 transition-all"
                >
                  <div className="mb-5">
                    <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">Starter</span>
                    <h4 className="text-2xl font-bold text-white mt-2">BASIC</h4>
                    <p className="text-zinc-400 text-sm mt-1">For small sellers</p>
                  </div>
                  
                  <div className="mb-5">
                    <div className="flex items-baseline gap-1">
                      <span className="text-5xl font-black text-white">$19</span>
                      <span className="text-zinc-400 text-lg">/mo</span>
                    </div>
                    <p className="text-cyan-400 text-sm mt-2 font-medium">Best for beginners</p>
                  </div>

                  <div className="space-y-3 mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 bg-cyan-500/20 rounded-lg flex items-center justify-center">
                        <Check className="w-4 h-4 text-cyan-400" />
                      </div>
                      <span className="text-zinc-300">Up to <strong className="text-white">5,000</strong> listings</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 bg-cyan-500/20 rounded-lg flex items-center justify-center">
                        <Check className="w-4 h-4 text-cyan-400" />
                      </div>
                      <span className="text-zinc-300"><strong className="text-white">1</strong> Store connected</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 bg-cyan-500/20 rounded-lg flex items-center justify-center">
                        <Check className="w-4 h-4 text-cyan-400" />
                      </div>
                      <span className="text-zinc-300">CSV Export (AutoDS, eBay)</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 bg-cyan-500/20 rounded-lg flex items-center justify-center">
                        <Check className="w-4 h-4 text-cyan-400" />
                      </div>
                      <span className="text-zinc-300">5-Filter Zombie Detection</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 bg-cyan-500/20 rounded-lg flex items-center justify-center">
                        <Check className="w-4 h-4 text-cyan-400" />
                      </div>
                      <span className="text-zinc-300">Email Support</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                        <Check className="w-4 h-4 text-emerald-400" />
                      </div>
                      <span className="text-emerald-300 font-semibold">Credit Rollover ✨</span>
                    </div>
                  </div>

                  <a
                    href="https://optlisting.lemonsqueezy.com/checkout/basic"
                    className="block w-full py-3 bg-zinc-700 hover:bg-cyan-600 text-white font-bold rounded-xl text-center transition-all"
                  >
                    Get Started
                  </a>
                </motion.div>

                {/* PRO Plan (RECOMMENDED) */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.35 }}
                  className="relative bg-gradient-to-b from-blue-600/20 to-zinc-800/80 border-2 border-blue-500/50 rounded-2xl p-6 shadow-2xl shadow-blue-500/10 transform md:scale-105"
                >
                  {/* RECOMMENDED Badge */}
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="px-4 py-1.5 bg-gradient-to-r from-blue-600 to-blue-500 text-white text-xs font-bold rounded-full shadow-lg shadow-blue-500/30 uppercase tracking-wider">
                      ⭐ RECOMMENDED
                    </span>
                  </div>

                  <div className="mt-3 mb-5">
                    <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">Most Popular</span>
                    <h4 className="text-2xl font-bold text-white mt-2">PRO</h4>
                    <p className="text-zinc-400 text-sm mt-1">Best value for growing sellers</p>
                  </div>
                  
                  <div className="mb-5">
                    <div className="flex items-baseline gap-1">
                      <span className="text-5xl font-black text-white">$49</span>
                      <span className="text-zinc-400 text-lg">/mo</span>
                    </div>
                    <p className="text-emerald-400 text-sm mt-2 font-medium">💡 Save 60% vs pay-per-scan</p>
                  </div>

                  <div className="space-y-3 mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 bg-blue-500/30 rounded-lg flex items-center justify-center">
                        <Check className="w-4 h-4 text-blue-400" />
                      </div>
                      <span className="text-zinc-300">Up to <strong className="text-white">50,000</strong> listings</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 bg-blue-500/30 rounded-lg flex items-center justify-center">
                        <Check className="w-4 h-4 text-blue-400" />
                      </div>
                      <span className="text-zinc-300"><strong className="text-white">5</strong> Stores connected</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 bg-blue-500/30 rounded-lg flex items-center justify-center">
                        <Check className="w-4 h-4 text-blue-400" />
                      </div>
                      <span className="text-zinc-300">All CSV Formats</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 bg-blue-500/30 rounded-lg flex items-center justify-center">
                        <Check className="w-4 h-4 text-blue-400" />
                      </div>
                      <span className="text-zinc-300">Cross-Platform Health Check</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 bg-blue-500/30 rounded-lg flex items-center justify-center">
                        <Check className="w-4 h-4 text-blue-400" />
                      </div>
                      <span className="text-zinc-300">Priority Support</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 bg-emerald-500/30 rounded-lg flex items-center justify-center">
                        <Check className="w-4 h-4 text-emerald-400" />
                      </div>
                      <span className="text-emerald-300 font-semibold">Credit Rollover ✨</span>
                    </div>
                  </div>

                  <a
                    href="https://optlisting.lemonsqueezy.com/checkout/pro"
                    className="block w-full py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold rounded-xl text-center transition-all shadow-lg shadow-blue-500/30 hover:shadow-blue-500/40"
                  >
                    Best Value →
                  </a>
                </motion.div>

                {/* POWER SELLER Plan */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.4 }}
                  className="relative bg-gradient-to-b from-purple-600/15 to-zinc-800/80 border border-purple-500/30 rounded-2xl p-6 hover:border-purple-500/50 transition-all"
                >
                  {/* Enterprise Badge */}
                  <div className="absolute -top-3 right-4">
                    <span className="px-3 py-1 bg-purple-500/20 text-purple-400 text-xs font-bold rounded-full border border-purple-500/30">
                      🚀 ENTERPRISE
                    </span>
                  </div>

                  <div className="mt-2 mb-5">
                    <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">High Volume</span>
                    <h4 className="text-2xl font-bold text-white mt-2">POWER SELLER</h4>
                    <p className="text-zinc-400 text-sm mt-1">For enterprise-level sellers</p>
                  </div>
                  
                  <div className="mb-5">
                    <div className="flex items-baseline gap-1">
                      <span className="text-5xl font-black text-white">$99</span>
                      <span className="text-zinc-400 text-lg">/mo</span>
                    </div>
                    <p className="text-emerald-400 text-sm mt-2 font-medium">💡 Save 80% vs pay-per-scan</p>
                  </div>

                  <div className="space-y-3 mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 bg-purple-500/20 rounded-lg flex items-center justify-center">
                        <Check className="w-4 h-4 text-purple-400" />
                      </div>
                      <span className="text-zinc-300">Up to <strong className="text-white">150,000</strong> listings</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 bg-purple-500/20 rounded-lg flex items-center justify-center">
                        <Check className="w-4 h-4 text-purple-400" />
                      </div>
                      <span className="text-zinc-300"><strong className="text-white">15</strong> Stores connected</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 bg-purple-500/20 rounded-lg flex items-center justify-center">
                        <Check className="w-4 h-4 text-purple-400" />
                      </div>
                      <span className="text-zinc-300">All CSV Formats</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 bg-purple-500/20 rounded-lg flex items-center justify-center">
                        <Check className="w-4 h-4 text-purple-400" />
                      </div>
                      <span className="text-zinc-300">Global Winner Detection</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 bg-purple-500/20 rounded-lg flex items-center justify-center">
                        <Check className="w-4 h-4 text-purple-400" />
                      </div>
                      <span className="text-zinc-300">Dedicated Account Manager</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                        <Check className="w-4 h-4 text-emerald-400" />
                      </div>
                      <span className="text-emerald-300 font-semibold">Credit Rollover ✨</span>
                    </div>
                  </div>

                  <a
                    href="https://optlisting.lemonsqueezy.com/checkout/power-seller"
                    className="block w-full py-3 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white font-bold rounded-xl text-center transition-all shadow-lg shadow-purple-500/20"
                  >
                    Get Started
                  </a>
                </motion.div>
              </div>
            </motion.div>

            {/* FAQ / Trust Elements */}
            <div className="mt-12 text-center">
              <p className="text-zinc-500 text-sm">
                Questions? <a href="#support" className="text-blue-400 hover:text-blue-300 underline">Contact our support team</a>
              </p>
              <div className="flex items-center justify-center gap-6 mt-4 text-zinc-600 text-xs">
                <span>🔒 Secure Payment via Lemon Squeezy</span>
                <span>•</span>
                <span>💳 Cancel Anytime</span>
                <span>•</span>
                <span>📧 24/7 Email Support</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 bg-slate-900 text-white">
        <div className="container mx-auto max-w-6xl">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-4 md:mb-0">
              <div className="flex items-center space-x-3 mb-2">
                <div className="p-2 bg-blue-600 rounded-lg">
                  <Zap className="h-5 w-5 text-white" />
                </div>
                <span className="text-xl font-bold">OptListing</span>
              </div>
              <p className="text-gray-400 text-sm">© 2026 OptListing. All rights reserved.</p>
            </div>
            <div className="flex gap-6">
              <a href="#support" className="text-gray-400 hover:text-white transition-colors">Support</a>
              <a href="#terms" className="text-gray-400 hover:text-white transition-colors">Terms</a>
              <a href="#privacy" className="text-gray-400 hover:text-white transition-colors">Privacy</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default LandingPage
