"use client";

import { Shield, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6 md:p-12">
      <div className="max-w-3xl mx-auto">
        <Link 
          href="/" 
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-8 group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Back to Home
        </Link>

        <header className="mb-12">
          <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center mb-4 border border-blue-500/20">
            <Shield className="w-6 h-6 text-blue-400" />
          </div>
          <h1 className="text-4xl font-bold mb-4">Privacy Policy</h1>
          <p className="text-gray-400">Last updated: June 8, 2026</p>
        </header>

        <div className="prose prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-blue-400">1. Information We Collect</h2>
            <p className="text-gray-300 leading-relaxed">
              AdSpawn connects to your Meta Advertising account via Facebook Login. We only request the minimum permissions necessary to manage your campaigns:
            </p>
            <ul className="list-disc pl-6 text-gray-400 space-y-2">
              <li>Public profile information (name and profile picture)</li>
              <li>Ads management permissions (`ads_management`)</li>
              <li>Ads insights permissions (`ads_read`)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-blue-400">2. How We Use Data</h2>
            <p className="text-gray-300 leading-relaxed">
              We use your Meta API tokens to fetch campaign data, create drafts, and publish changes back to your Meta Ad Account. We do not sell your data or use it for advertising outside of your own managed accounts.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-blue-400">3. Data Retention</h2>
            <p className="text-gray-300 leading-relaxed">
              We store your campaign drafts and local configurations in our secure database. You can request data deletion at any time by contacting our support team or deleting your account profile within the app.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-blue-400">4. Third-Party Services</h2>
            <p className="text-gray-300 leading-relaxed">
              Our service relies entirely on the Meta Graph API. By using AdSpawn, you also agree to Meta's Terms of Service and Privacy Policy.
            </p>
          </section>

          <section className="pt-8 border-t border-gray-800">
            <p className="text-sm text-gray-500 italic">
              See also our <Link href="/terms" className="text-blue-400 hover:text-blue-300 not-italic">Terms of Service</Link>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
