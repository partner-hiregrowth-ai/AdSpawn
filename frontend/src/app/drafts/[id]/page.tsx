"use client";

import { useEffect, useState, use } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { draftApi } from "@/services/api";
import { 
  ChevronRight, 
  ChevronDown, 
  Save, 
  Send, 
  ShieldCheck, 
  AlertTriangle,
  FileText,
  Layers,
  Megaphone,
  Plus
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

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
    if (!confirm("Are you sure you want to publish this to Meta? This will create real campaigns, ad sets, and ads (all in PAUSED status).")) return;
    
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

  if (isLoading) return <DashboardLayout><div className="p-8">Loading draft...</div></DashboardLayout>;
  if (!draft) return <DashboardLayout><div className="p-8">Draft not found</div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full space-y-4">
        {/* Header */}
        <div className="flex justify-between items-center border-b border-gray-800 pb-4">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold">{draft.name}</h1>
            <Badge variant={draft.status === 'READY' ? 'default' : 'outline'}>{draft.status}</Badge>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="gap-2" onClick={handleValidate} disabled={isValidating}>
              <ShieldCheck className={`w-4 h-4 ${isValidating ? 'animate-spin' : ''}`} />
              Validate
            </Button>
            <Button className="gap-2 bg-blue-600 hover:bg-blue-700" onClick={handlePublish} disabled={isPublishing || draft.status === 'PUBLISHING' || draft.status === 'PUBLISHED'}>
              <Send className="w-4 h-4" />
              {isPublishing ? 'Publishing...' : 'Publish to Meta'}
            </Button>
          </div>
        </div>

        <div className="flex flex-1 gap-6 overflow-hidden">
          {/* Tree View */}
          <div className="w-80 border-r border-gray-800 overflow-y-auto pr-4">
            <div className="space-y-4">
              {/* Campaign Node */}
              <div 
                className={`p-3 rounded-lg cursor-pointer flex items-center gap-3 transition-colors ${selectedNode?.type === 'CAMPAIGN' ? 'bg-blue-600/20 border border-blue-600' : 'hover:bg-gray-900'}`}
                onClick={() => handleSelectNode('CAMPAIGN', draft)}
              >
                <Megaphone className="w-5 h-5 text-blue-500" />
                <span className="text-sm font-medium truncate">{draft.name}</span>
              </div>

              {/* Ad Set Nodes */}
              <div className="pl-6 space-y-4 border-l border-gray-800">
                {draft.adSets?.map((adSet: any) => (
                  <div key={adSet.id} className="space-y-2">
                    <div 
                      className={`p-2 rounded-lg cursor-pointer flex items-center gap-3 transition-colors ${selectedNode?.type === 'ADSET' && selectedNode.id === adSet.id ? 'bg-blue-600/20 border border-blue-600' : 'hover:bg-gray-900'}`}
                      onClick={() => handleSelectNode('ADSET', adSet)}
                    >
                      <Layers className="w-4 h-4 text-purple-500" />
                      <span className="text-xs font-medium truncate">{adSet.name}</span>
                    </div>

                    {/* Ad Nodes */}
                    <div className="pl-6 space-y-1">
                      {adSet.ads?.map((ad: any) => (
                        <div 
                          key={ad.id}
                          className={`p-2 rounded-lg cursor-pointer flex items-center gap-3 transition-colors ${selectedNode?.type === 'AD' && selectedNode.id === ad.id ? 'bg-blue-600/20 border border-blue-600' : 'hover:bg-gray-900'}`}
                          onClick={() => handleSelectNode('AD', ad)}
                        >
                          <FileText className="w-3.5 h-3.5 text-green-500" />
                          <span className="text-[10px] truncate">{ad.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Editor Area */}
          <div className="flex-1 overflow-y-auto p-2">
            {editData ? (
              <div className="space-y-6 max-w-2xl">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold">Editing {selectedNode?.type}</h2>
                  <Button size="sm" className="gap-2" onClick={handleSave} disabled={isSaving}>
                    <Save className="w-4 h-4" />
                    Save Changes
                  </Button>
                </div>

                {/* Validation Errors for selected node */}
                {editData.validationErrors && editData.validationErrors.length > 0 && (
                  <div className="bg-red-500/10 border border-red-500/50 p-4 rounded-lg space-y-2">
                    <div className="flex items-center gap-2 text-red-500">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="text-sm font-bold">Validation Issues</span>
                    </div>
                    <ul className="text-xs text-red-400 list-disc pl-5">
                      {editData.validationErrors.map((err: any, idx: number) => (
                        <li key={idx}>{err.message} ({err.field})</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="grid gap-6">
                  <Tabs defaultValue="form" className="w-full">
                    <TabsList className="bg-gray-900 border border-gray-800">
                      <TabsTrigger value="form">Edit Form</TabsTrigger>
                      <TabsTrigger value="summary">Summary</TabsTrigger>
                      <TabsTrigger value="json">Raw JSON</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="form" className="space-y-6 mt-4">
                      <div className="space-y-2">
                        <Label>Name</Label>
                        <Input 
                          value={editData.name} 
                          onChange={(e) => handleUpdateField('name', e.target.value)} 
                          className="bg-gray-900 border-gray-800"
                        />
                      </div>

                      {selectedNode?.type === 'CAMPAIGN' && (
                        <div className="space-y-2">
                          <Label>Objective</Label>
                          <Input 
                            value={editData.objective || ''} 
                            onChange={(e) => handleUpdateField('objective', e.target.value)} 
                            className="bg-gray-900 border-gray-800"
                          />
                        </div>
                      )}

                      {selectedNode?.type === 'ADSET' && (
                        <>
                          <div className="space-y-2">
                            <Label>Optimization Goal</Label>
                            <Input 
                              value={editData.data?.optimization_goal || ''} 
                              onChange={(e) => handleUpdateDataField('optimization_goal', e.target.value)} 
                              className="bg-gray-900 border-gray-800"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Billing Event</Label>
                            <Input 
                              value={editData.data?.billing_event || ''} 
                              onChange={(e) => handleUpdateDataField('billing_event', e.target.value)} 
                              className="bg-gray-900 border-gray-800"
                            />
                          </div>
                        </>
                      )}
                    </TabsContent>

                    <TabsContent value="summary" className="mt-4">
                      <Card className="bg-gray-900 border-gray-800">
                        <CardContent className="pt-6">
                          <div className="space-y-4">
                            <div className="flex justify-between border-b border-gray-800 pb-2">
                              <span className="text-gray-400">Type</span>
                              <span className="font-medium">{selectedNode?.type}</span>
                            </div>
                            <div className="flex justify-between border-b border-gray-800 pb-2">
                              <span className="text-gray-400">Name</span>
                              <span className="font-medium">{editData.name}</span>
                            </div>
                            {Object.entries(editData.data || {}).map(([key, value]: [string, any]) => {
                              if (typeof value === 'string' || typeof value === 'number') {
                                return (
                                  <div key={key} className="flex justify-between border-b border-gray-800 pb-2">
                                    <span className="text-gray-400 capitalize">{key.replace(/_/g, ' ')}</span>
                                    <span className="font-medium truncate max-w-[300px]">{String(value)}</span>
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
                      <div className="space-y-2">
                        <Label>Raw Data (JSON Editor)</Label>
                        <textarea 
                          className="w-full h-96 bg-gray-900 border border-gray-800 rounded-lg p-4 font-mono text-xs"
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
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                Select an item from the tree to edit
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
