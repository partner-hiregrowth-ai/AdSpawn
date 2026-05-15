"use client";

import { useEffect, useState, use } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { draftApi } from "@/services/api";
import {
  Save,
  Send,
  ShieldCheck,
  AlertTriangle,
  FileText,
  Layers,
  Megaphone,
  Loader2,
  ArrowLeft
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import Link from "next/link";

export default function DraftEditorPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = use(paramsPromise);
  const router = useRouter();
  const [draft, setDraft] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<{ type: 'CAMPAIGN' | 'ADSET' | 'AD', id: string } | null>(null);
  const [editData, setEditData] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [validationResults, setValidationResults] = useState<any>(null);

  const fetchDraft = async () => {
    try {
      setIsLoading(true);
      const response = await draftApi.getCampaign(params.id);
      setDraft(response.data);
      if (!selectedNode) {
        setSelectedNode({ type: 'CAMPAIGN', id: response.data.id });
        setEditData(response.data);
      }
    } catch (error) {
      toast.error("Failed to load draft details");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDraft();
  }, [params.id]);

  const handleSelectNode = (type: 'CAMPAIGN' | 'ADSET' | 'AD', item: any) => {
    setSelectedNode({ type, id: item.id });
    setEditData(item);
  };

  const handleUpdateField = (field: string, value: any) => {
    setEditData({ ...editData, [field]: value });
  };

  const handleUpdateDataField = (field: string, value: any) => {
    setEditData({
      ...editData,
      data: { ...editData.data, [field]: value }
    });
  };

  const handleSave = async () => {
    if (!selectedNode || !editData) return;
    setIsSaving(true);
    try {
      if (selectedNode.type === 'CAMPAIGN') {
        await draftApi.updateCampaign(selectedNode.id, editData);
      } else if (selectedNode.type === 'ADSET') {
        await draftApi.updateAdSet(selectedNode.id, editData);
      } else if (selectedNode.type === 'AD') {
        await draftApi.updateAd(selectedNode.id, editData);
      }
      toast.success("Changes saved");
      fetchDraft();
    } catch (error) {
      toast.error("Failed to save changes");
    } finally {
      setIsSaving(false);
    }
  };

  const handleValidate = async () => {
    setIsValidating(true);
    try {
      const response = await draftApi.validateDraft(params.id);
      setValidationResults(response.data);
      if (response.data.isValid) {
        toast.success("Validation passed!");
      } else {
        toast.error("Validation failed. Please fix the errors.");
      }
      fetchDraft();
    } catch (error) {
      toast.error("Validation failed");
    } finally {
      setIsValidating(false);
    }
  };

  const handlePublish = async () => {
    if (!confirm("Publish to Meta? This will create real campaigns, ad sets, and ads (all PAUSED).")) return;

    setIsPublishing(true);
    try {
      await draftApi.publishDraft(params.id);
      toast.success("Published successfully!");
      router.push("/drafts");
    } catch (error: any) {
      console.error("Publishing failed:", error);
      toast.error(error.response?.data?.error || "Publishing failed");
    } finally {
      setIsPublishing(false);
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        </div>
      </DashboardLayout>
    );
  }

  if (!draft) {
    return (
      <DashboardLayout>
        <div className="text-center py-16 text-gray-500">Draft not found</div>
      </DashboardLayout>
    );
  }

  const statusColor = draft.status === 'READY' ? 'text-emerald-400 bg-emerald-500/15' :
    draft.status === 'PUBLISHED' ? 'text-emerald-500 bg-emerald-500/10' :
    'text-gray-400 bg-gray-800/50';

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full space-y-4">
        {/* Header */}
        <div className="flex justify-between items-center pb-4 border-b border-gray-800/40">
          <div className="flex items-center gap-3">
            <Link href="/drafts">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-gray-300">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-100">{draft.name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", statusColor)}>
                  {draft.status}
                </span>
                <span className="text-xs text-gray-600">{draft.objective}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 border-gray-800 text-gray-400" onClick={handleValidate} disabled={isValidating}>
              <ShieldCheck className={cn("w-3.5 h-3.5", isValidating && "animate-spin")} />
              Validate
            </Button>
            <Button
              size="sm"
              className="gap-1.5 bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/20"
              onClick={handlePublish}
              disabled={isPublishing || draft.status === 'PUBLISHING' || draft.status === 'PUBLISHED'}
            >
              <Send className="w-3.5 h-3.5" />
              {isPublishing ? 'Publishing...' : 'Publish to Meta'}
            </Button>
          </div>
        </div>

        <div className="flex flex-1 gap-5 overflow-hidden">
          {/* Tree View */}
          <div className="w-72 border-r border-gray-800/40 overflow-y-auto pr-3">
            <div className="space-y-3">
              {/* Campaign Node */}
              <button
                className={cn(
                  "w-full p-2.5 rounded-lg flex items-center gap-2.5 transition-all text-left",
                  selectedNode?.type === 'CAMPAIGN'
                    ? 'bg-blue-500/10 border border-blue-500/30'
                    : 'hover:bg-gray-800/40'
                )}
                onClick={() => handleSelectNode('CAMPAIGN', draft)}
              >
                <div className="w-7 h-7 rounded-md bg-blue-500/10 flex items-center justify-center shrink-0">
                  <Megaphone className="w-3.5 h-3.5 text-blue-400" />
                </div>
                <span className="text-sm font-medium truncate text-gray-200">{draft.name}</span>
              </button>

              {/* Ad Set Nodes */}
              <div className="pl-5 space-y-2 border-l border-gray-800/40 ml-3.5">
                {draft.adSets?.map((adSet: any) => (
                  <div key={adSet.id} className="space-y-1.5">
                    <button
                      className={cn(
                        "w-full p-2 rounded-lg flex items-center gap-2.5 transition-all text-left",
                        selectedNode?.type === 'ADSET' && selectedNode.id === adSet.id
                          ? 'bg-blue-500/10 border border-blue-500/30'
                          : 'hover:bg-gray-800/40'
                      )}
                      onClick={() => handleSelectNode('ADSET', adSet)}
                    >
                      <div className="w-6 h-6 rounded-md bg-purple-500/10 flex items-center justify-center shrink-0">
                        <Layers className="w-3 h-3 text-purple-400" />
                      </div>
                      <span className="text-xs font-medium truncate text-gray-300">{adSet.name}</span>
                    </button>

                    {/* Ad Nodes */}
                    <div className="pl-5 space-y-1 border-l border-gray-800/30 ml-3">
                      {adSet.ads?.map((ad: any) => (
                        <button
                          key={ad.id}
                          className={cn(
                            "w-full p-1.5 rounded-lg flex items-center gap-2 transition-all text-left",
                            selectedNode?.type === 'AD' && selectedNode.id === ad.id
                              ? 'bg-blue-500/10 border border-blue-500/30'
                              : 'hover:bg-gray-800/40'
                          )}
                          onClick={() => handleSelectNode('AD', ad)}
                        >
                          <div className="w-5 h-5 rounded bg-green-500/10 flex items-center justify-center shrink-0">
                            <FileText className="w-2.5 h-2.5 text-green-400" />
                          </div>
                          <span className="text-[11px] truncate text-gray-400">{ad.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Editor Area */}
          <div className="flex-1 overflow-y-auto">
            {editData ? (
              <div className="space-y-5 max-w-2xl">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-gray-800/50 text-gray-500 uppercase tracking-wide">
                      {selectedNode?.type}
                    </span>
                  </div>
                  <Button size="sm" className="gap-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200" onClick={handleSave} disabled={isSaving}>
                    {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    Save
                  </Button>
                </div>

                {/* Validation Errors */}
                {editData.validationErrors && editData.validationErrors.length > 0 && (
                  <div className="bg-red-500/5 border border-red-500/20 p-3.5 rounded-lg space-y-2">
                    <div className="flex items-center gap-2 text-red-400">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span className="text-xs font-semibold">Validation Issues</span>
                    </div>
                    <ul className="text-[11px] text-red-400/80 list-disc pl-5 space-y-0.5">
                      {editData.validationErrors.map((err: any, idx: number) => (
                        <li key={idx}>{err.message} <span className="text-red-500/40">({err.field})</span></li>
                      ))}
                    </ul>
                  </div>
                )}

                <Tabs defaultValue="form" className="w-full">
                  <TabsList className="bg-gray-900/50 border border-gray-800/60 h-9">
                    <TabsTrigger value="form" className="text-xs">Edit Form</TabsTrigger>
                    <TabsTrigger value="summary" className="text-xs">Summary</TabsTrigger>
                    <TabsTrigger value="json" className="text-xs">Raw JSON</TabsTrigger>
                  </TabsList>

                  <TabsContent value="form" className="space-y-4 mt-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-gray-400">Name</Label>
                      <Input
                        value={editData.name}
                        onChange={(e) => handleUpdateField('name', e.target.value)}
                        className="bg-gray-900/50 border-gray-800/60 focus:border-blue-500/50"
                      />
                    </div>

                    {selectedNode?.type === 'CAMPAIGN' && (
                      <div className="space-y-1.5">
                        <Label className="text-xs text-gray-400">Objective</Label>
                        <Input
                          value={editData.objective || ''}
                          onChange={(e) => handleUpdateField('objective', e.target.value)}
                          className="bg-gray-900/50 border-gray-800/60 focus:border-blue-500/50"
                        />
                      </div>
                    )}

                    {selectedNode?.type === 'ADSET' && (
                      <>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-gray-400">Optimization Goal</Label>
                          <Input
                            value={editData.data?.optimization_goal || ''}
                            onChange={(e) => handleUpdateDataField('optimization_goal', e.target.value)}
                            className="bg-gray-900/50 border-gray-800/60 focus:border-blue-500/50"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-gray-400">Billing Event</Label>
                          <Input
                            value={editData.data?.billing_event || ''}
                            onChange={(e) => handleUpdateDataField('billing_event', e.target.value)}
                            className="bg-gray-900/50 border-gray-800/60 focus:border-blue-500/50"
                          />
                        </div>
                      </>
                    )}
                  </TabsContent>

                  <TabsContent value="summary" className="mt-4">
                    <Card className="bg-gray-900/30 border-gray-800/60">
                      <CardContent className="pt-5">
                        <div className="space-y-3">
                          <div className="flex justify-between items-center py-2 border-b border-gray-800/30">
                            <span className="text-xs text-gray-500">Type</span>
                            <span className="text-xs font-medium text-gray-300">{selectedNode?.type}</span>
                          </div>
                          <div className="flex justify-between items-center py-2 border-b border-gray-800/30">
                            <span className="text-xs text-gray-500">Name</span>
                            <span className="text-xs font-medium text-gray-300">{editData.name}</span>
                          </div>
                          {Object.entries(editData.data || {}).map(([key, value]: [string, any]) => {
                            if (typeof value === 'string' || typeof value === 'number') {
                              return (
                                <div key={key} className="flex justify-between items-center py-2 border-b border-gray-800/30">
                                  <span className="text-xs text-gray-500 capitalize">{key.replace(/_/g, ' ')}</span>
                                  <span className="text-xs font-medium truncate max-w-[280px] text-gray-300">{String(value)}</span>
                                </div>
                              );
                            }
                            return null;
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="json" className="mt-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-gray-400">Raw Data</Label>
                      <textarea
                        className="w-full h-96 bg-gray-900/50 border border-gray-800/60 rounded-lg p-4 font-mono text-xs text-gray-300 focus:outline-none focus:border-blue-500/50 transition-colors"
                        value={JSON.stringify(editData.data, null, 2)}
                        onChange={(e) => {
                          try {
                            handleUpdateField('data', JSON.parse(e.target.value));
                          } catch (err) {}
                        }}
                      />
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-600 text-sm">
                Select an item from the tree to edit
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
