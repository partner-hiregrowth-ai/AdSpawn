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

export const authApi = {
  loginWithFacebook: (accessToken: string) => api.post('/auth/facebook', { accessToken }),
};

export const adAccountApi = {
  getAdAccounts: () => api.get('/adaccounts'),
  getCampaigns: (adAccountId: string) => api.get(`/adaccounts/${adAccountId}/campaigns`),
  getAdSets: (campaignId: string) => api.get(`/adaccounts/campaigns/${campaignId}/adsets`),
  getAds: (adSetId: string) => api.get(`/adaccounts/adsets/${adSetId}/ads`),
};

export const duplicationApi = {
  getHistory: () => api.get('/duplicate/history'),
  duplicateCampaign: (data: any) => api.post('/duplicate/campaign', data),
  duplicateAdSet: (data: any) => api.post('/duplicate/adset', data),
  duplicateAd: (data: any) => api.post('/duplicate/ad', data),
  duplicateBulk: (data: { 
    items: Array<{ id: string, type: string, name: string }>, 
    adAccountId: string, 
    options: { numCopies: number, renamePattern: string, deep: boolean, customBudget?: string, context?: any } 
  }) => api.post('/duplicate/bulk', data),
};

export const templateApi = {
  getTemplates: () => api.get('/templates'),
  createTemplate: (data: any) => api.post('/templates', data),
  updateTemplate: (id: string, data: any) => api.put(`/templates/${id}`, data),
  deleteTemplate: (id: string) => api.delete(`/templates/${id}`),
};

export default api;
