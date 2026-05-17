import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const data = error.response?.data;
    if (error.response?.status === 401 && data?.code === 'TOKEN_EXPIRED') {
      localStorage.removeItem('token');
      window.location.href = '/login?reason=token_expired';
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  loginWithFacebook: (accessToken: string) => api.post('/auth/facebook', { accessToken }),
};

export const adAccountApi = {
  getAdAccounts: () => api.get('/adaccounts'),
  getCampaigns: (adAccountId: string) => api.get(`/adaccounts/${adAccountId}/campaigns`),
  getAdSets: (campaignId: string) => api.get(`/adaccounts/campaigns/${campaignId}/adsets`),
  getAds: (adSetId: string) => api.get(`/adaccounts/adsets/${adSetId}/ads`),
  updateName: (id: string, newName: string) => api.patch('/adaccounts/update-name', { id, newName }),
  bulkDelete: (ids: string[]) => api.post('/adaccounts/bulk-delete', { ids }),
};

export const duplicationApi = {
  getHistory: () => api.get('/duplicate/history'),
  deleteHistory: (id: string) => api.delete(`/duplicate/history/${id}`),
  cleanupHistory: () => api.post('/duplicate/sync'),
  duplicateCampaign: (data: any) => api.post('/duplicate/campaign', data),
  duplicateAdSet: (data: any) => api.post('/duplicate/adset', data),
  duplicateAd: (data: any) => api.post('/duplicate/ad', data),
  duplicateBulk: (data: { 
    items: Array<{ id: string, type: string, name: string }>, 
    adAccountId: string, 
    options: { numCopies: number, renamePattern: string, deep: boolean, customBudget?: string, context?: any } 
  }) => api.post('/duplicate/bulk', data),
  previewConversion: (data: { type: string, id: string, targetObjective: string, newName?: string }) =>
    api.post('/duplicate/preview-conversion', data),
  convertObjective: (data: { items: Array<{ id: string, type: string, name: string }>, targetObjective: string, newName?: string, adAccountId: string, saveAsDraft?: boolean }) =>
    api.post('/duplicate/convert-objective', data),
  optimizeDuplicate: (data: { type: string, id: string, overrides?: any }) =>
    api.post('/duplicate/optimize-duplicate', data),
  optimizeConversion: (data: { type: string, id: string, targetObjective: string, newName?: string }) =>
    api.post('/duplicate/optimize-conversion', data),
  validateOptimization: (data: { entityType: string, payload: any, campaignObjective?: string }) =>
    api.post('/duplicate/validate-optimization', data),
};

export const templateApi = {
  getTemplates: () => api.get('/templates'),
  createTemplate: (data: any) => api.post('/templates', data),
  updateTemplate: (id: string, data: any) => api.put(`/templates/${id}`, data),
  deleteTemplate: (id: string) => api.delete(`/templates/${id}`),
};

export const wideCreationApi = {
  validate: (template: any) => api.post('/wide-creation/validate', template),
  generate: (template: any) => api.post('/wide-creation/generate', template),
  bulkApply: (data: { entityIds: string[]; entityType: string; fieldUpdates: any; cascadeToChildren?: boolean }) =>
    api.post('/wide-creation/bulk-apply', data),
  getTree: (campaignIds: string[]) => api.post('/wide-creation/tree', { campaignIds }),
};

export const draftApi = {
  duplicateToDraft: (campaignId: string) => api.post('/drafts/duplicate', { campaignId }),
  listCampaigns: () => api.get('/drafts/campaigns'),
  getCampaign: (id: string) => api.get(`/drafts/campaigns/${id}`),
  updateCampaign: (id: string, data: any) => api.patch(`/drafts/campaigns/${id}`, data),
  deleteCampaign: (id: string) => api.delete(`/drafts/campaigns/${id}`),
  updateAdSet: (id: string, data: any) => api.patch(`/drafts/adsets/${id}`, data),
  updateAd: (id: string, data: any) => api.patch(`/drafts/ads/${id}`, data),
  validateDraft: (id: string) => api.post(`/drafts/campaigns/${id}/validate`),
  publishDraft: (id: string) => api.post(`/drafts/campaigns/${id}/publish`),
  bulkPublishDrafts: (campaignIds: string[]) => api.post('/drafts/campaigns/bulk-publish', { campaignIds }),
  bulkUpdateCampaigns: (campaignIds: string[], updates: any) => api.post('/drafts/campaigns/bulk-update', { campaignIds, updates }),
  bulkDeleteDrafts: (campaignIds: string[]) => api.post('/drafts/campaigns/bulk-delete', { campaignIds }),
  cleanupMetaObjects: (id: string) => api.post(`/drafts/campaigns/${id}/cleanup`),
  bulkEditSchema: (draftIds: string[], level: string = 'campaign') =>
    api.post('/drafts/bulk-edit/schema', { draftIds, level }),
  bulkEditValidate: (draftIds: string[], fieldUpdates: Record<string, any>, level: string = 'campaign') =>
    api.post('/drafts/bulk-edit/validate', { draftIds, fieldUpdates, level }),
  bulkEditApply: (draftIds: string[], fieldUpdates: Record<string, any>, level: string = 'campaign') =>
    api.post('/drafts/bulk-edit/apply', { draftIds, fieldUpdates, level }),
  getFormSchema: (entityType: string, context?: any) =>
    api.post('/drafts/form-schema', { entityType, context }),
};

export default api;
