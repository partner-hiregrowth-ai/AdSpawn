import axios from 'axios';
import { toast } from 'sonner';

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

let tokenWarningShown = false;

api.interceptors.response.use(
  (response) => {
    const expiryWarning = response.headers['x-token-expiry-warning'];
    if (expiryWarning && !tokenWarningShown) {
      tokenWarningShown = true;
      const expiresAt = new Date(expiryWarning);
      const daysLeft = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      toast.warning(`Your Facebook session expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}. Please log in again soon.`, {
        duration: 10000,
        id: 'token-expiry-warning',
      });
    }
    return response;
  },
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
  bulkActivate: (ids: string[]) => api.post('/adaccounts/bulk-activate', { ids }),
  bulkPause: (ids: string[]) => api.post('/adaccounts/bulk-pause', { ids }),
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
  duplicateToDraft: (campaignId: string, count?: number) =>
    api.post('/drafts/duplicate', count && count > 1 ? { campaignId, count } : { campaignId }),
  listCampaigns: (page = 1, pageSize = 50) => api.get('/drafts/campaigns', { params: { page, pageSize } }),
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
  exportCampaign: (id: string) => api.get(`/drafts/campaigns/${id}/export`),
  importCampaign: (exported: any, adAccountId?: string) =>
    api.post('/drafts/import', { exported, adAccountId }),
};

export const userApi = {
  getProfile: () => api.get('/user/profile'),
  getTokenStatus: () => api.get('/user/token-status'),
  getStats: () => api.get('/user/stats'),
  deleteAccount: () => api.delete('/user/account'),
};

export const uploadApi = {
  uploadImage: (file: File, adAccountId: string) => {
    const form = new FormData();
    form.append('file', file);
    form.append('adAccountId', adAccountId);
    return api.post('/uploads/image', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  uploadVideo: (file: File, adAccountId: string) => {
    const form = new FormData();
    form.append('file', file);
    form.append('adAccountId', adAccountId);
    return api.post('/uploads/video', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

export default api;
