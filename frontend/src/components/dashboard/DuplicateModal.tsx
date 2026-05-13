"use client";

import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle, Info, Loader2, Coins, Globe, Target, Sparkles, Copy } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { duplicationApi } from "@/services/api";
import { NamingTemplateEditor } from "./NamingTemplateEditor";
import { NamingPreview } from "./NamingPreview";

interface DuplicateModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedItems: Array<{ id: string, type: string, name: string }>;
  adAccountId: string;
  onSuccess: () => void;
}

export const DuplicateModal = ({ isOpen, onClose, selectedItems, adAccountId, onSuccess }: DuplicateModalProps) => {
  const [renamePattern, setRenamePattern] = useState("{{campaign_name}}{{adset_name}}{{ad_name}} - Copy");
  const [numCopies, setNumCopies] = useState(1);
  const [customBudget, setCustomBudget] = useState("40");
  const [country, setCountry] = useState("TH");
  const [angle, setAngle] = useState("UGC");
  const [deep, setDeep] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleDuplicate = async () => {
    if (!adAccountId) {
      toast.error("No ad account selected");
      return;
    }

    setLoading(true);
    try {
      await duplicationApi.duplicateBulk({
        items: selectedItems,
        adAccountId,
        options: {
          numCopies,
          renamePattern,
          deep,
          customBudget: customBudget || undefined,
          context: {
            country,
            angle
          }
        }
      });
      
      toast.success(`Successfully duplicated ${selectedItems.length * numCopies} items!`);
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error(error);
      const message = error.response?.data?.message || "Failed to start duplication";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const hasCampaigns = selectedItems.some(item => item.type === 'CAMPAIGN');
  
  const previewContext = useMemo(() => ({
    country,
    angle,
    budget: customBudget,
    campaign_name: selectedItems.find(i => i.type === 'CAMPAIGN')?.name,
    adset_name: selectedItems.find(i => i.type === 'ADSET')?.name,
    ad_name: selectedItems.find(i => i.type === 'AD')?.name,
  }), [country, angle, customBudget, selectedItems]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto bg-gray-900 border-gray-800 text-gray-100">
        <DialogHeader>
          <div>
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              <Copy className="w-6 h-6 text-blue-400" />
              Duplicate Structures
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Configure naming and duplication settings for {selectedItems.length} items.
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="bg-amber-900/20 border border-amber-500/30 p-4 rounded-lg flex gap-3 text-amber-200">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <div className="text-sm">
              <p className="font-bold mb-1">Safety Enforcement</p>
              New structures will be created as <strong>PAUSED</strong>.
            </div>
          </div>

          {/* Advanced Naming Engine */}
          <div className="space-y-3">
            <NamingTemplateEditor 
              onPatternChange={setRenamePattern} 
              initialPattern={renamePattern}
              type={hasCampaigns ? "CAMPAIGN" : "ALL"}
            />
            <NamingPreview pattern={renamePattern} context={previewContext} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="country" className="flex items-center gap-2">
                <Globe className="w-3 h-3 text-blue-400" />
                Target Country
              </Label>
              <Input 
                id="country" 
                value={country} 
                onChange={(e) => setCountry(e.target.value)}
                className="bg-gray-950 border-gray-800 focus:border-blue-500"
                placeholder="e.g. TH"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="angle" className="flex items-center gap-2">
                <Target className="w-3 h-3 text-purple-400" />
                Marketing Angle
              </Label>
              <Input 
                id="angle" 
                value={angle} 
                onChange={(e) => setAngle(e.target.value)}
                className="bg-gray-950 border-gray-800 focus:border-blue-500"
                placeholder="e.g. UGC, Promo, Sales"
              />
            </div>
          </div>

          <div className="flex gap-4">
            <div className="space-y-2 flex-1">
              <Label htmlFor="copies">Number of Copies</Label>
              <Input 
                id="copies" 
                type="number" 
                min={1} 
                max={50}
                value={numCopies} 
                onChange={(e) => setNumCopies(parseInt(e.target.value) || 1)}
                className="bg-gray-950 border-gray-800 focus:border-blue-500"
              />
            </div>

            <div className="space-y-2 flex-1">
              <Label htmlFor="budget" className="flex items-center gap-2">
                <Coins className="w-3 h-3 text-yellow-500" />
                Daily Budget (THB)
              </Label>
              <Input 
                id="budget" 
                type="number" 
                min={0}
                step={0.01}
                value={customBudget} 
                onChange={(e) => setCustomBudget(e.target.value)}
                className="bg-gray-950 border-gray-800 focus:border-blue-500 text-yellow-400 font-mono"
              />
            </div>
          </div>

          {hasCampaigns && (
            <div className="flex items-center space-x-2 bg-gray-950 p-3 rounded-lg border border-gray-800">
              <Checkbox 
                id="deep" 
                checked={deep} 
                onCheckedChange={(checked) => setDeep(!!checked)}
              />
              <div className="grid gap-1.5 leading-none">
                <label htmlFor="deep" className="text-sm font-medium leading-none">
                  Deep Duplication
                </label>
                <p className="text-xs text-gray-500">
                  Include all Ad Sets and Ads within selected Campaigns.
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button 
            onClick={handleDuplicate} 
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white min-w-[150px]"
          >
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Duplicating...</> : `Confirm Duplication`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
