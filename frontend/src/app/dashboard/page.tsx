"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard, Globe, RefreshCcw, Loader2, ArrowRight } from "lucide-react";
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
          <div className="flex flex-col items-center justify-center p-20 text-gray-500 gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            <p className="text-sm">Fetching your ad accounts...</p>
          </div>
        ) : adAccounts.length === 0 ? (
          <div className="bg-gray-900/50 border border-gray-800/60 rounded-xl p-16 text-center">
            <CreditCard className="w-10 h-10 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-400 font-medium">No ad accounts found</p>
            <p className="text-gray-600 text-sm mt-1">Make sure your Facebook user has access to ad accounts.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {adAccounts.map((account, index) => (
              <Card
                key={account.id}
                className={cn(
                  "border-gray-800/60 bg-gray-900/50 hover:bg-gray-900 hover:border-blue-500/30 transition-all duration-200 cursor-pointer group card-glow opacity-0 animate-fade-in-up",
                  `stagger-${Math.min(index + 1, 6)}`
                )}
                onClick={() => handleSelectAccount(account)}
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
