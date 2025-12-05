import { Link } from 'react-router-dom'
import { ArrowLeft, Zap } from 'lucide-react'

function PrivacyPolicy() {
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
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Privacy Policy</h1>
          <p className="text-zinc-400 text-sm mb-8">Last updated: January 1, 2025</p>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">1. Introduction</h2>
            <p className="text-zinc-300 leading-relaxed mb-4">
              OptListing ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy 
              explains how we collect, use, disclose, and safeguard your information when you use our Service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">2. Information We Collect</h2>
            
            <h3 className="text-xl font-semibold mb-3 mt-6">2.1 Account Information</h3>
            <ul className="list-disc list-inside text-zinc-300 space-y-2 mb-4">
              <li>Email address</li>
              <li>Name (if provided)</li>
              <li>Authentication credentials (handled by Supabase Auth)</li>
              <li>Profile picture (if provided via OAuth)</li>
            </ul>

            <h3 className="text-xl font-semibold mb-3 mt-6">2.2 Store Connection Data</h3>
            <ul className="list-disc list-inside text-zinc-300 space-y-2 mb-4">
              <li>eBay API tokens and credentials</li>
              <li>Store IDs and marketplace identifiers</li>
              <li>Connection status and sync timestamps</li>
            </ul>

            <h3 className="text-xl font-semibold mb-3 mt-6">2.3 Listing Data</h3>
            <ul className="list-disc list-inside text-zinc-300 space-y-2 mb-4">
              <li>Item IDs, SKUs, titles, and descriptions</li>
              <li>Pricing and inventory information</li>
              <li>Sales metrics (views, impressions, sales count)</li>
              <li>Supplier and source information</li>
              <li>Images and product URLs</li>
            </ul>

            <h3 className="text-xl font-semibold mb-3 mt-6">2.4 Usage Data</h3>
            <ul className="list-disc list-inside text-zinc-300 space-y-2 mb-4">
              <li>Feature usage and interactions</li>
              <li>CSV downloads and exports</li>
              <li>Filter and search queries</li>
              <li>Error logs and performance metrics</li>
            </ul>

            <h3 className="text-xl font-semibold mb-3 mt-6">2.5 Technical Data</h3>
            <ul className="list-disc list-inside text-zinc-300 space-y-2 mb-4">
              <li>IP address and location data</li>
              <li>Browser type and version</li>
              <li>Device information</li>
              <li>Cookies and tracking technologies</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">3. How We Use Your Information</h2>
            <p className="text-zinc-300 leading-relaxed mb-4">We use collected information to:</p>
            <ul className="list-disc list-inside text-zinc-300 space-y-2 mb-4">
              <li>Provide, maintain, and improve the Service</li>
              <li>Process transactions and manage subscriptions</li>
              <li>Analyze listings and generate zombie detection reports</li>
              <li>Generate CSV files for bulk deletion</li>
              <li>Send service-related notifications and updates</li>
              <li>Respond to support requests and inquiries</li>
              <li>Detect and prevent fraud or abuse</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">4. Data Storage and Security</h2>
            <p className="text-zinc-300 leading-relaxed mb-4">
              Your data is stored securely using:
            </p>
            <ul className="list-disc list-inside text-zinc-300 space-y-2 mb-4">
              <li><strong>Supabase:</strong> PostgreSQL database with encryption at rest</li>
              <li><strong>Authentication:</strong> Supabase Auth with OAuth support</li>
              <li><strong>API Security:</strong> HTTPS/TLS encryption for all data in transit</li>
              <li><strong>Access Controls:</strong> User-based data isolation and permissions</li>
            </ul>
            <p className="text-zinc-300 leading-relaxed mb-4">
              While we implement industry-standard security measures, no method of transmission over the Internet 
              is 100% secure. We cannot guarantee absolute security.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">5. Data Sharing and Disclosure</h2>
            <p className="text-zinc-300 leading-relaxed mb-4">We do not sell your personal data. We may share information only in these cases:</p>
            
            <h3 className="text-xl font-semibold mb-3 mt-6">5.1 Service Providers</h3>
            <ul className="list-disc list-inside text-zinc-300 space-y-2 mb-4">
              <li><strong>Supabase:</strong> Database and authentication hosting</li>
              <li><strong>Lemon Squeezy:</strong> Payment processing (transaction data only)</li>
              <li><strong>Vercel:</strong> Frontend hosting and CDN</li>
              <li><strong>eBay API:</strong> To fetch your listing data (with your authorization)</li>
            </ul>

            <h3 className="text-xl font-semibold mb-3 mt-6">5.2 Legal Requirements</h3>
            <p className="text-zinc-300 leading-relaxed mb-4">
              We may disclose information if required by law, court order, or government regulation.
            </p>

            <h3 className="text-xl font-semibold mb-3 mt-6">5.3 Business Transfers</h3>
            <p className="text-zinc-300 leading-relaxed mb-4">
              In the event of a merger, acquisition, or sale, your data may be transferred to the new entity.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">6. Your Rights and Choices</h2>
            <p className="text-zinc-300 leading-relaxed mb-4">You have the right to:</p>
            <ul className="list-disc list-inside text-zinc-300 space-y-2 mb-4">
              <li><strong>Access:</strong> Request a copy of your personal data</li>
              <li><strong>Correction:</strong> Update or correct inaccurate information</li>
              <li><strong>Deletion:</strong> Request deletion of your account and data</li>
              <li><strong>Portability:</strong> Export your data in a machine-readable format</li>
              <li><strong>Opt-out:</strong> Unsubscribe from marketing emails (service emails may still be sent)</li>
              <li><strong>Disconnect Stores:</strong> Remove store connections at any time</li>
            </ul>
            <p className="text-zinc-300 leading-relaxed mb-4">
              To exercise these rights, contact us at support@optlisting.com.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">7. Cookies and Tracking</h2>
            <p className="text-zinc-300 leading-relaxed mb-4">
              We use cookies and similar technologies to:
            </p>
            <ul className="list-disc list-inside text-zinc-300 space-y-2 mb-4">
              <li>Maintain your session and authentication state</li>
              <li>Remember your preferences and settings</li>
              <li>Analyze usage patterns and improve the Service</li>
              <li>Provide personalized experiences</li>
            </ul>
            <p className="text-zinc-300 leading-relaxed mb-4">
              You can control cookies through your browser settings, but this may affect Service functionality.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">8. Third-Party Services</h2>
            <p className="text-zinc-300 leading-relaxed mb-4">
              Our Service integrates with third-party services that have their own privacy policies:
            </p>
            <ul className="list-disc list-inside text-zinc-300 space-y-2 mb-4">
              <li><strong>eBay:</strong> For fetching listing data (see eBay's Privacy Policy)</li>
              <li><strong>Google OAuth:</strong> For authentication (see Google's Privacy Policy)</li>
              <li><strong>Lemon Squeezy:</strong> For payment processing (see Lemon Squeezy's Privacy Policy)</li>
            </ul>
            <p className="text-zinc-300 leading-relaxed mb-4">
              We are not responsible for the privacy practices of these third parties.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">9. Data Retention</h2>
            <p className="text-zinc-300 leading-relaxed mb-4">
              We retain your data for as long as:
            </p>
            <ul className="list-disc list-inside text-zinc-300 space-y-2 mb-4">
              <li>Your account is active</li>
              <li>Necessary to provide the Service</li>
              <li>Required by law or legal obligations</li>
              <li>Needed to resolve disputes or enforce agreements</li>
            </ul>
            <p className="text-zinc-300 leading-relaxed mb-4">
              Upon account deletion, we will delete your data within 30 days, except where retention is required by law.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">10. Children's Privacy</h2>
            <p className="text-zinc-300 leading-relaxed mb-4">
              Our Service is not intended for users under 18 years of age. We do not knowingly collect personal 
              information from children. If you believe we have collected information from a child, please contact us immediately.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">11. International Data Transfers</h2>
            <p className="text-zinc-300 leading-relaxed mb-4">
              Your data may be transferred to and processed in countries other than your country of residence. 
              These countries may have different data protection laws. By using the Service, you consent to such transfers.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">12. Changes to This Policy</h2>
            <p className="text-zinc-300 leading-relaxed mb-4">
              We may update this Privacy Policy from time to time. Material changes will be notified via email 
              or through the Service. Your continued use after changes constitutes acceptance.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">13. Contact Us</h2>
            <p className="text-zinc-300 leading-relaxed mb-4">
              If you have questions about this Privacy Policy or wish to exercise your rights, contact us at:
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

export default PrivacyPolicy

