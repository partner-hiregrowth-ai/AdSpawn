"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";

// Objective forms are large (~1k lines each) and a given surface only ever
// needs the ones for its objective, so they are loaded on demand instead of
// being bundled into every route that renders them.
export function FormLoadingSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="space-y-1.5">
          <div className="h-3 w-28 bg-gray-800/60 rounded" />
          <div className="h-8 w-full bg-gray-800/40 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

const lazyForm = (loader: () => Promise<ComponentType<any>>) =>
  dynamic(loader, { ssr: false, loading: () => <FormLoadingSkeleton /> });

// Keyed by `${objective}:${nodeType}` where nodeType is CAMPAIGN | ADSET | AD.
// Consumers fall back to the schema-driven MetaForm / DynamicField renderers
// when a key is missing.
export const OBJECTIVE_FORMS: Record<string, ComponentType<any>> = {
  "OUTCOME_AWARENESS:CAMPAIGN": lazyForm(() => import("@/components/campaign/AwarenessCampaignForm").then(m => m.AwarenessCampaignForm)),
  "OUTCOME_AWARENESS:ADSET": lazyForm(() => import("@/components/campaign/AwarenessAdSetForm").then(m => m.AwarenessAdSetForm)),
  "OUTCOME_AWARENESS:AD": lazyForm(() => import("@/components/campaign/AwarenessAdForm").then(m => m.AwarenessAdForm)),
  "OUTCOME_TRAFFIC:CAMPAIGN": lazyForm(() => import("@/components/campaign/TrafficCampaignForm").then(m => m.TrafficCampaignForm)),
  "OUTCOME_TRAFFIC:ADSET": lazyForm(() => import("@/components/campaign/TrafficAdSetForm").then(m => m.TrafficAdSetForm)),
  "OUTCOME_TRAFFIC:AD": lazyForm(() => import("@/components/campaign/TrafficAdForm").then(m => m.TrafficAdForm)),
  "OUTCOME_ENGAGEMENT:CAMPAIGN": lazyForm(() => import("@/components/campaign/EngagementCampaignForm").then(m => m.EngagementCampaignForm)),
  "OUTCOME_ENGAGEMENT:ADSET": lazyForm(() => import("@/components/campaign/EngagementAdSetForm").then(m => m.EngagementAdSetForm)),
  "OUTCOME_ENGAGEMENT:AD": lazyForm(() => import("@/components/campaign/EngagementAdForm").then(m => m.EngagementAdForm)),
  "OUTCOME_LEADS:CAMPAIGN": lazyForm(() => import("@/components/campaign/LeadsCampaignForm").then(m => m.LeadsCampaignForm)),
  "OUTCOME_LEADS:ADSET": lazyForm(() => import("@/components/campaign/LeadsAdSetForm").then(m => m.LeadsAdSetForm)),
  "OUTCOME_LEADS:AD": lazyForm(() => import("@/components/campaign/LeadsAdForm").then(m => m.LeadsAdForm)),
  "OUTCOME_APP_PROMOTION:CAMPAIGN": lazyForm(() => import("@/components/campaign/AppPromotionCampaignForm").then(m => m.AppPromotionCampaignForm)),
  "OUTCOME_APP_PROMOTION:ADSET": lazyForm(() => import("@/components/campaign/AppPromotionAdSetForm").then(m => m.AppPromotionAdSetForm)),
  "OUTCOME_APP_PROMOTION:AD": lazyForm(() => import("@/components/campaign/AppPromotionAdForm").then(m => m.AppPromotionAdForm)),
  "OUTCOME_SALES:CAMPAIGN": lazyForm(() => import("@/components/campaign/SalesCampaignForm").then(m => m.SalesCampaignForm)),
  "OUTCOME_SALES:ADSET": lazyForm(() => import("@/components/campaign/SalesAdSetForm").then(m => m.SalesAdSetForm)),
  "OUTCOME_SALES:AD": lazyForm(() => import("@/components/campaign/SalesAdForm").then(m => m.SalesAdForm)),
};
