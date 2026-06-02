"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard, Globe, RefreshCcw, Loader2, ArrowRight, X } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { useEffect, useState } from "react";
import { adAccountApi } from "@/services/api";
import { AdAccount } from "@/types";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { cn, extractApiError } from "@/lib/utils";

export default function DashboardPage() {
  const router = useRouter();
  const { setAdAccounts, adAccounts, setSelectedAccount } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('adspawn-onboarded')) {
      setShowBanner(true);
    }
  }, []);

  const dismissBanner = () => {
    localStorage.setItem('adspawn-onboarded', '1');
    setShowBanner(false);
  };

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const response = await adAccountApi.getAdAccounts();
      setAdAccounts(response.data);
    } catch (error: any) {
      toast.error(extractApiError(error, "Couldn't load your Meta ad accounts. Check your Facebook connection in Settings and try again."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleSelectAccount = (account: AdAccount) => {
    setSelectedAccount(account);
    toast.success(`Selected ${account.name}`);
    router.push("/explorer");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {showBanner && (
          <div className="bg-blue-500/5 border border-blue-500/15 rounded-xl p-4 flex items-start gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-blue-400 mb-3">How AdSpawn works</p>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-5">
                {[
                  { n: 1, label: "Select an account", desc: "Pick any ad account on this page" },
                  { n: 2, label: "Browse in Explorer", desc: "Find campaigns, ad sets, and ads" },
                  { n: 3, label: "Duplicate or convert", desc: "Save as draft — always starts PAUSED" },
                ].map((step, i, arr) => (
                  <div key={step.n} className="flex items-start gap-2.5 sm:contents">
                    <div className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-blue-500/15 text-blue-400 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {step.n}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-gray-300">{step.label}</p>
                        <p className="text-[11px] text-gray-500 mt-0.5">{step.desc}</p>
                      </div>
                    </div>
                    {i < arr.length - 1 && (
                      <ArrowRight className="w-3.5 h-3.5 text-gray-700 shrink-0 mt-1 hidden sm:block" />
                    )}
                  </div>
                ))}
              </div>
            </div>
            <button
              onClick={dismissBanner}
              className="p-1 text-gray-600 hover:text-gray-400 rounded transition-colors shrink-0 mt-0.5"
              aria-label="Dismiss workflow guide"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold text-gray-100">Ad Accounts</h2>
            <p className="text-gray-500 mt-1 text-sm">Select an account to start managing campaigns.</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAccounts}
            disabled={loading}
            className="gap-2 border-gray-800 text-gray-400 hover:text-gray-200"
          >
            <RefreshCcw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="border-gray-800/40 bg-gray-900/30">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-lg bg-gray-800/60 animate-pulse" />
                    <div className="w-4 h-4 rounded bg-gray-800/40 animate-pulse" />
                  </div>
                  <div className="h-5 w-3/4 bg-gray-800/50 rounded mt-3 animate-pulse" />
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center justify-between">
                    <div className="h-3 w-24 bg-gray-800/40 rounded animate-pulse" />
                    <div className="h-4 w-10 bg-gray-800/40 rounded animate-pulse" />
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-800/40">
                    <div className="h-3 w-32 bg-gray-800/30 rounded animate-pulse" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : adAccounts.length === 0 ? (
          <div className="bg-gray-900/50 border border-gray-800/60 rounded-xl p-16 text-center">
            <CreditCard className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 font-medium">No ad accounts found</p>
            <p className="text-gray-500 text-sm mt-1">Make sure your Facebook user has access to ad accounts.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {adAccounts.map((account, index) => (
              <Card
                key={account.id}
                tabIndex={0}
                role="button"
                aria-label={`Select ${account.name}`}
                className={cn(
                  "border-gray-800/60 bg-gray-900/50 hover:bg-gray-900/80 hover:border-blue-500/30 transition-all duration-200 cursor-pointer group card-glow animate-fade-in-up",
                  "focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950",
                  `stagger-${Math.min(index + 1, 6)}`
                )}
                onClick={() => handleSelectAccount(account)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelectAccount(account); } }}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/10 flex items-center justify-center">
                      <CreditCard className="w-4 h-4 text-blue-400" />
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-700 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <CardTitle className="text-base font-semibold mt-3 truncate text-gray-200 group-hover:text-white transition-colors">
                    {account.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-gray-500">
                      <Globe className="w-3 h-3" />
                      <span>{account.timezone_name}</span>
                    </div>
                    {account.currency && (
                      <span className="text-[11px] text-gray-600 font-mono bg-gray-800/60 px-1.5 py-0.5 rounded">
                        {account.currency}
                      </span>
                    )}
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-800/60">
                    <span className="text-[11px] text-gray-600 font-mono">
                      {account.adaccount_id || account.id}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
