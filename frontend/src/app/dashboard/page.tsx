"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard, Globe, RefreshCcw, Loader2 } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { useEffect, useState } from "react";
import { adAccountApi } from "@/services/api";
import { AdAccount } from "@/types";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const router = useRouter();
  const { setAdAccounts, adAccounts, setSelectedAccount } = useAppStore();
  const [loading, setLoading] = useState(false);

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const response = await adAccountApi.getAdAccounts();
      setAdAccounts(response.data);
    } catch (error) {
      toast.error("Failed to load ad accounts");
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
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold">Select Ad Account</h2>
            <p className="text-gray-400 mt-1">Choose an account to start duplicating campaigns.</p>
          </div>
          <Button variant="outline" onClick={fetchAccounts} disabled={loading} className="gap-2 border-gray-800">
            <RefreshCcw className={cn("w-4 h-4", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center p-20 text-gray-500 gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            <p>Fetching your ad accounts...</p>
          </div>
        ) : adAccounts.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center text-gray-500">
            No ad accounts found for this Facebook user.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {adAccounts.map((account) => (
              <Card 
                key={account.id} 
                className="border-gray-800 bg-gray-900 hover:border-blue-500/50 transition-all cursor-pointer group"
                onClick={() => handleSelectAccount(account)}
              >
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="truncate">{account.name}</span>
                    <div className="w-8 h-8 rounded-full bg-blue-900/30 flex items-center justify-center">
                      <CreditCard className="w-4 h-4 text-blue-400" />
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Globe className="w-4 h-4" />
                    {account.timezone_name}
                  </div>
                  <div className="flex items-center justify-between pt-4 border-t border-gray-800">
                    <span className="text-xs text-gray-500">ID: {account.adaccount_id || account.id}</span>
                    <span className="text-sm font-bold text-blue-400">{account.currency}</span>
                  </div>
                  <Button className="w-full mt-2 group-hover:bg-blue-600 transition-colors">
                    Manage Account
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}
