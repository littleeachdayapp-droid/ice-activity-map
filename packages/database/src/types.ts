export type ActivityType = 'raid' | 'checkpoint' | 'arrest' | 'surveillance' | 'other';
export type ReportStatus = 'unverified' | 'verified' | 'disputed';
export type ReportSource = 'bluesky' | 'user_submitted';

export interface Report {
  id: string;
  sourceType: ReportSource;
  sourceId: string | null;
  activityType: ActivityType;
  description: string;
  city: string | null;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
  authorHandle: string;
  authorDisplayName: string | null;
  status: ReportStatus;
  reportedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateReportInput {
  sourceType: ReportSource;
  sourceId?: string;
  activityType: ActivityType;
  description: string;
  city?: string;
  state?: string;
  latitude?: number;
  longitude?: number;
  authorHandle: string;
  authorDisplayName?: string;
  status?: ReportStatus;
  reportedAt: Date;
}

export interface ReportFilters {
  activityTypes?: ActivityType[];
  timeRange?: '24h' | '7d' | '30d' | 'all';
  status?: ReportStatus[];
  bounds?: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
}

export interface PaginationOptions {
  limit?: number;
  offset?: number;
}
