"use client";

import { FileText, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function TermsPage() {
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
            <FileText className="w-6 h-6 text-blue-400" />
          </div>
          <h1 className="text-4xl font-bold mb-4">Terms of Service</h1>
          <p className="text-gray-400">Last updated: June 10, 2026</p>
        </header>

        <div className="prose prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-blue-400">1. Acceptance of Terms</h2>
            <p className="text-gray-300 leading-relaxed">
              By accessing or using AdSpawn, you agree to be bound by these Terms of Service. If you do not agree, do not use the service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-blue-400">2. Description of Service</h2>
            <p className="text-gray-300 leading-relaxed">
              AdSpawn is a tool for managing Meta advertising campaigns: duplicating campaigns, converting objectives, editing drafts, and publishing changes to your own Meta Ad Accounts via the Meta Graph API. All campaign changes are created in a paused state and require your explicit action to go live.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-blue-400">3. Your Responsibilities</h2>
            <ul className="list-disc pl-6 text-gray-400 space-y-2">
              <li>You must own or have authorized access to the Meta Ad Accounts you connect.</li>
              <li>You are responsible for all campaigns published through your account, including their content, budgets, and compliance with Meta's Advertising Policies.</li>
              <li>You must not use AdSpawn to violate Meta's Terms of Service or any applicable law.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-blue-400">4. Disclaimer of Warranties</h2>
            <p className="text-gray-300 leading-relaxed">
              AdSpawn is provided &quot;as is&quot; without warranties of any kind. We do not guarantee that campaigns created through the service will be approved by Meta, perform as expected, or be free of errors. You should review all drafts before publishing.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-blue-400">5. Limitation of Liability</h2>
            <p className="text-gray-300 leading-relaxed">
              To the maximum extent permitted by law, AdSpawn shall not be liable for any indirect, incidental, or consequential damages, including ad spend losses, arising from your use of the service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-blue-400">6. Changes to These Terms</h2>
            <p className="text-gray-300 leading-relaxed">
              We may update these terms from time to time. Continued use of the service after changes constitutes acceptance of the revised terms.
            </p>
          </section>

          <section className="pt-8 border-t border-gray-800">
            <p className="text-sm text-gray-500 italic">
              See also our <Link href="/privacy" className="text-blue-400 hover:text-blue-300 not-italic">Privacy Policy</Link>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
