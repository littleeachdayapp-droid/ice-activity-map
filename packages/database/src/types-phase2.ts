export interface PushSubscription {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  latitude: number | null;
  longitude: number | null;
  radiusKm: number;
  activityTypes: string[];
  createdAt: Date;
  lastNotifiedAt: Date | null;
}

export interface CreatePushSubscriptionInput {
  endpoint: string;
  p256dh: string;
  auth: string;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  activityTypes?: string[];
}

export interface ReportVerification {
  id: string;
  reportId: string;
  userIdentifier: string;
  vote: 'confirm' | 'dispute';
  comment: string | null;
  createdAt: Date;
}

export interface CreateVerificationInput {
  reportId: string;
  userIdentifier: string;
  vote: 'confirm' | 'dispute';
  comment?: string;
}

export type FlagReason = 'spam' | 'misinformation' | 'duplicate' | 'inappropriate' | 'other';
export type FlagStatus = 'pending' | 'reviewed' | 'resolved' | 'dismissed';

export interface ReportFlag {
  id: string;
  reportId: string;
  userIdentifier: string;
  reason: FlagReason;
  details: string | null;
  status: FlagStatus;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
}

export interface CreateFlagInput {
  reportId: string;
  userIdentifier: string;
  reason: FlagReason;
  details?: string;
}

export interface ModerationAction {
  id: string;
  reportId: string | null;
  action: string;
  moderator: string;
  reason: string | null;
  previousStatus: string | null;
  newStatus: string | null;
  createdAt: Date;
}
