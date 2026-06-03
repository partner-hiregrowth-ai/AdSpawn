export interface User {
  id: string;
  facebookId?: string | null;
  name: string;
  email: string;
  role?: string;
  teamId?: string;
}

export interface Team {
  id: string;
  name: string;
  inviteCode?: string;
  ownerId: string;
  members: TeamMember[];
  memberCount: number;
}

export interface TeamMember {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
}

export interface AdAccount {
  id: string;
  adaccount_id: string;
  name: string;
  currency: string;
  timezone_name: string;
}

export interface Campaign {
  id: string;
  name: string;
  status: string;
  objective: string;
  daily_budget?: string;
  lifetime_budget?: string;
  created_time?: string;
}

export interface AdSet {
  id: string;
  name: string;
  status: string;
  campaign_id: string;
  targeting: TargetingSpec;
  daily_budget?: string;
  lifetime_budget?: string;
}

export interface Ad {
  id: string;
  name: string;
  status: string;
  adset_id: string;
  creative: {
    id: string;
  };
}

export interface DuplicateJob {
  id: string;
  status: string;
  type: string;
  sourceId: string;
  targetId?: string;
  createdAt: string;
}

export type DraftStatus = 'DRAFT' | 'VALIDATED' | 'VALIDATION_FAILED' | 'PUBLISHING' | 'PUBLISHED' | 'FAILED';

export interface DraftCampaign {
  id: string;
  name: string;
  objective: string;
  status: DraftStatus;
  metaId?: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { adSets: number };
}

export interface DraftShare {
  id: string;
  permission: 'view' | 'edit';
  sharedBy?: { name: string } | null;
  draftCampaign?: DraftCampaign | null;
}

export interface HistoryJobDetails {
  operation?: 'PUBLISH' | 'DRAFT_DUPLICATE' | 'AI_CREATE' | 'WIDE_CREATE' | string;
  isConversion?: boolean;
  adAccountId?: string;
  templateName?: string;
  totalCreated?: { campaigns: number; adSets: number; ads: number };
}

export interface HistoryJob {
  id: string;
  status: string;
  type: string;
  sourceId: string;
  targetId?: string | null;
  createdAt: string;
  details?: HistoryJobDetails | null;
  profile?: { name: string } | null;
}

export interface TokenStatus {
  valid: boolean;
  expiresAt: string | null;
  scopes: string[];
  message?: string;
}

export interface UserStats {
  draftCount: number;
  publishedCount: number;
  jobCount: number;
  accountCount: number;
}

export interface UserProfile {
  id: string;
  facebookId: string;
  name: string | null;
  email: string | null;
  createdAt: string;
}

export interface OptimizationEntity {
  sourceId?: string;
  fields?: Array<{
    field: string;
    label?: string;
    action: string;
    reason?: string;
    originalValue?: unknown;
    newValue: unknown;
    editable?: boolean;
    type?: string;
    enumValues?: string[];
    enumLabels?: Record<string, string>;
  }>;
  payload?: Record<string, unknown>;
}

export interface OptimizationData {
  campaign?: OptimizationEntity;
  adSets?: OptimizationEntity[];
}

export interface TargetingSpec {
  age_min?: number;
  age_max?: number;
  genders?: number[];
  geo_locations?: {
    countries?: string[];
    regions?: { key: string; name?: string }[];
    cities?: { key: string; name?: string }[];
  };
  flexible_spec?: Record<string, unknown>[];
  exclusions?: Record<string, unknown>;
  [key: string]: unknown;
}
