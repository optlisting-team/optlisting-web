import { Link } from 'react-router-dom'
import { ArrowLeft, Zap } from 'lucide-react'

function TermsOfService() {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <nav className="fixed top-0 left-0 right-0 bg-black/60 backdrop-blur-xl border-b border-zinc-800 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg shadow-lg shadow-blue-500/20">
              <Zap className="h-6 w-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-white">OptListing</span>
          </Link>
          <Link
            to="/"
            className="flex items-center gap-2 px-4 py-2 text-zinc-300 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </div>
      </nav>

      {/* Content */}
      <div className="container mx-auto max-w-4xl px-4 pt-32 pb-20">
        <div className="prose prose-invert prose-lg max-w-none">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Terms of Service</h1>
          <p className="text-zinc-400 text-sm mb-8">Last updated: January 1, 2025</p>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">1. Acceptance of Terms</h2>
            <p className="text-zinc-300 leading-relaxed mb-4">
              By accessing or using OptListing ("Service"), you agree to be bound by these Terms of Service ("Terms"). 
              If you disagree with any part of these terms, you may not access the Service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">2. Description of Service</h2>
            <p className="text-zinc-300 leading-relaxed mb-4">
              OptListing is a Software-as-a-Service (SaaS) platform that helps eBay dropshippers identify 
              low-performing or "zombie" listings and generate CSV files for bulk deletion. The Service includes:
            </p>
            <ul className="list-disc list-inside text-zinc-300 space-y-2 mb-4">
              <li>Listing analysis and zombie detection</li>
              <li>CSV file generation for bulk deletion</li>
              <li>Store connection and synchronization</li>
              <li>Dashboard and reporting features</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">3. User Accounts</h2>
            <p className="text-zinc-300 leading-relaxed mb-4">
              To use the Service, you must create an account. You are responsible for:
            </p>
            <ul className="list-disc list-inside text-zinc-300 space-y-2 mb-4">
              <li>Maintaining the confidentiality of your account credentials</li>
              <li>All activities that occur under your account</li>
              <li>Notifying us immediately of any unauthorized use</li>
              <li>Providing accurate and complete information</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">4. Subscription and Payment</h2>
            <p className="text-zinc-300 leading-relaxed mb-4">
              The Service is offered through subscription plans and credit packs:
            </p>
            <ul className="list-disc list-inside text-zinc-300 space-y-2 mb-4">
              <li><strong>Subscriptions:</strong> Monthly recurring billing. You may cancel anytime.</li>
              <li><strong>Credit Packs:</strong> One-time purchases that do not expire.</li>
              <li><strong>Refunds:</strong> Subscription fees are non-refundable. Credit pack refunds are handled on a case-by-case basis.</li>
              <li><strong>Price Changes:</strong> We reserve the right to modify pricing with 30 days notice.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">5. Acceptable Use</h2>
            <p className="text-zinc-300 leading-relaxed mb-4">You agree not to:</p>
            <ul className="list-disc list-inside text-zinc-300 space-y-2 mb-4">
              <li>Use the Service for any illegal purpose</li>
              <li>Attempt to gain unauthorized access to the Service</li>
              <li>Reverse engineer, decompile, or disassemble the Service</li>
              <li>Use automated systems to access the Service without permission</li>
              <li>Interfere with or disrupt the Service or servers</li>
              <li>Share your account credentials with others</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">6. Data and Privacy</h2>
            <p className="text-zinc-300 leading-relaxed mb-4">
              Your use of the Service is also governed by our Privacy Policy. We collect and process:
            </p>
            <ul className="list-disc list-inside text-zinc-300 space-y-2 mb-4">
              <li>Account information (email, name)</li>
              <li>Store connection data (API tokens, store IDs)</li>
              <li>Listing data from your connected stores</li>
              <li>Usage analytics and performance metrics</li>
            </ul>
            <p className="text-zinc-300 leading-relaxed mb-4">
              We do not sell your data to third parties. Data is used solely to provide and improve the Service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">7. Service Availability</h2>
            <p className="text-zinc-300 leading-relaxed mb-4">
              We strive to maintain 99.9% uptime but do not guarantee uninterrupted access. The Service may be unavailable due to:
            </p>
            <ul className="list-disc list-inside text-zinc-300 space-y-2 mb-4">
              <li>Scheduled maintenance</li>
              <li>Technical issues or outages</li>
              <li>Third-party service dependencies (eBay API, etc.)</li>
              <li>Force majeure events</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">8. Limitation of Liability</h2>
            <p className="text-zinc-300 leading-relaxed mb-4">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, OPTLISTING SHALL NOT BE LIABLE FOR ANY INDIRECT, 
              INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO:
            </p>
            <ul className="list-disc list-inside text-zinc-300 space-y-2 mb-4">
              <li>Loss of profits, revenue, or data</li>
              <li>Business interruption</li>
              <li>Errors in listing analysis or CSV generation</li>
              <li>Deletion of listings based on our recommendations</li>
            </ul>
            <p className="text-zinc-300 leading-relaxed mb-4">
              Our total liability shall not exceed the amount you paid us in the 12 months preceding the claim.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">9. Disclaimer of Warranties</h2>
            <p className="text-zinc-300 leading-relaxed mb-4">
              THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, 
              EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO:
            </p>
            <ul className="list-disc list-inside text-zinc-300 space-y-2 mb-4">
              <li>Merchantability</li>
              <li>Fitness for a particular purpose</li>
              <li>Non-infringement</li>
              <li>Accuracy or completeness of analysis</li>
            </ul>
            <p className="text-zinc-300 leading-relaxed mb-4">
              You are solely responsible for reviewing and verifying any CSV files before bulk deletion.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">10. Termination</h2>
            <p className="text-zinc-300 leading-relaxed mb-4">
              We may terminate or suspend your account immediately, without prior notice, if you:
            </p>
            <ul className="list-disc list-inside text-zinc-300 space-y-2 mb-4">
              <li>Violate these Terms</li>
              <li>Engage in fraudulent or illegal activity</li>
              <li>Fail to pay subscription fees</li>
            </ul>
            <p className="text-zinc-300 leading-relaxed mb-4">
              Upon termination, your right to use the Service ceases immediately. We may delete your account and data.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">11. Changes to Terms</h2>
            <p className="text-zinc-300 leading-relaxed mb-4">
              We reserve the right to modify these Terms at any time. Material changes will be notified via email 
              or through the Service. Continued use after changes constitutes acceptance.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">12. Governing Law</h2>
            <p className="text-zinc-300 leading-relaxed mb-4">
              These Terms shall be governed by and construed in accordance with the laws of [Your Jurisdiction], 
              without regard to its conflict of law provisions.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">13. Contact Information</h2>
            <p className="text-zinc-300 leading-relaxed mb-4">
              If you have questions about these Terms, please contact us at:
            </p>
            <p className="text-zinc-300 leading-relaxed mb-4">
              <strong>Email:</strong> support@optlisting.com<br />
              <strong>Website:</strong> https://optlisting.com
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}

export default TermsOfService

