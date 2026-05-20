// Shared types for admin panel components

export interface FlaggedUser {
  id: string;
  email: string;
  name: string;
  flag_count: number;
  suspension_count: number;
  account_status: string;
  suspension_end: string | null;
}

export interface UserFlag {
  id: string;
  content_type: string;
  content: string;
  reason: string;
  status: string;
  created_at: string;
}

export interface ContestEntry {
  user_id: string;
  email: string;
  name: string;
  is_premium: boolean;
  is_lifetime: boolean;
  activity_score: number;
  journal_entries: number;
  meditation_sessions: number;
  oracle_readings: number;
  eligible: boolean;
}

export interface PromoCode {
  code: string;
  type: string;
  is_used: boolean;
  used_by: string | null;
  used_at: string | null;
  created_at: string;
}

export interface AppUser {
  id: string;
  user_id: string;
  email: string;
  name: string;
  is_admin: boolean;
  admin_level: number;
  is_premium: boolean;
  is_lifetime: boolean;
  account_status: string;
  flag_count: number;
  created_at: string;
}

export type TabType = 'users' | 'moderation' | 'contest';
export type UserSubTab = 'flagged' | 'all';

export interface ModerationStatus {
  pending_flags: number;
  suspended_users: number;
  cancelled_users: number;
  recent_actions: {
    flag_id: string;
    resolution: string;
    processed_at: string | null;
    processed_via: string;
  }[];
}

export interface PendingFlag {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  user_flag_count: number;
  user_account_status: string;
  content_type: string;
  content_id: string;
  content: string;
  reason: string;
  status: string;
  is_test: boolean;
  created_at: string | null;
  flags_before_suspension: number;
}

export const getStatusColor = (status: string): string => {
  switch (status) {
    case 'active': return '#10b981';
    case 'suspended': return '#f59e0b';
    case 'cancelled': return '#ef4444';
    default: return '#6b7280';
  }
};

export const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString();
};
