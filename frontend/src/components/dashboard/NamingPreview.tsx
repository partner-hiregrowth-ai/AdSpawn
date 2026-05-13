"use client";

import { useMemo } from "react";
import { format } from "date-fns";
import { Eye, Terminal, AlertCircle } from "lucide-react";

interface NamingPreviewProps {
  pattern: string;
  context: {
    campaign_name?: string;
    adset_name?: string;
    ad_name?: string;
    budget?: string | number;
    country?: string;
    angle?: string;
    iteration_number?: number;
  };
}

export const NamingPreview = ({ pattern, context }: NamingPreviewProps) => {
  const previewName = useMemo(() => {
    let result = pattern;
    
    const variables: Record<string, string | undefined> = {
      campaign_name: context.campaign_name || "Summer_Sale_2024",
      adset_name: context.adset_name || "US_Lookalike_1%",
      ad_name: context.ad_name || "Video_Creative_A",
      date: format(new Date(), "yyyy-MM-dd"),
      time: format(new Date(), "HH:mm"),
      budget: context.budget?.toString() || "1000",
      country: context.country || "TH",
      placement: "FB_Feeds",
      objective: "OUTCOME_SALES",
      iteration_number: context.iteration_number?.toString() || "1",
      angle: context.angle || "UGC",
      custom_text: "Promo"
    };

    const regex = /\{\{(.*?)\}\}/g;
    result = result.replace(regex, (match, p1) => {
      const [key, transform] = p1.split('|');
      let value = variables[key.trim()];

      if (value === undefined) return match;

      if (transform) {
        switch (transform.trim().toLowerCase()) {
          case 'upper': value = value.toUpperCase(); break;
          case 'lower': value = value.toLowerCase(); break;
          case 'snake': value = value.replace(/\s+/g, '_').toLowerCase(); break;
          case 'camel': value = value.replace(/(?:^\w|[A-Z]|\b\w)/g, (word: string, index: number) => index === 0 ? word.toLowerCase() : word.toUpperCase()).replace(/\s+/g, ''); break;
        }
      }

      return value;
    });

    return result;
  }, [pattern, context]);

  const isTooLong = previewName.length > 255;

  return (
    <div className="space-y-2">
      <div className={`bg-gray-900 border ${isTooLong ? 'border-red-500/50' : 'border-gray-800'} rounded-lg overflow-hidden transition-colors`}>
        <div className={`px-3 py-1.5 ${isTooLong ? 'bg-red-950/30' : 'bg-gray-800'} flex items-center justify-between`}>
          <span className={`text-[10px] font-bold ${isTooLong ? 'text-red-400' : 'text-gray-400'} flex items-center gap-1.5 uppercase tracking-wider`}>
            <Eye className="w-3 h-3" />
            Live Preview
          </span>
          <span className={`text-[10px] font-mono ${isTooLong ? 'text-red-400 font-bold' : 'text-gray-500'}`}>
            {previewName.length} / 255
          </span>
        </div>
        <div className="p-3">
          <p className={`text-sm font-mono ${isTooLong ? 'text-red-400' : 'text-blue-400'} break-all`}>
            {previewName}
          </p>
        </div>
      </div>
      
      {isTooLong && (
        <div className="flex items-center gap-2 text-[10px] text-red-400 bg-red-900/10 p-2 rounded border border-red-500/20">
          <AlertCircle className="w-3 h-3" />
          Name length exceeds Meta's 255 character limit. It will be truncated.
        </div>
      )}
    </div>
  );
};
