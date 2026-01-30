export type ActivityType =
  | 'raid'
  | 'checkpoint'
  | 'arrest'
  | 'surveillance'
  | 'other';

export type ReportStatus = 'unverified' | 'verified' | 'disputed';

export interface Report {
  id: string;
  activityType: ActivityType;
  location: {
    lat: number;
    lng: number;
    city: string;
    state: string;
  };
  description: string;
  timestamp: Date;
  author: string;
  status: ReportStatus;
}

export interface ListReport {
  id: string;
  activityType: ActivityType;
  city: string | null;
  state: string | null;
  description: string;
  timestamp: Date;
  author: string;
  status: ReportStatus;
  sourceType: string;
  hasLocation: boolean;
}

export interface FilterState {
  timeRange: '24h' | '7d' | '30d' | 'all';
  activityTypes: ActivityType[];
}

export const ACTIVITY_COLORS: Record<ActivityType, string> = {
  raid: '#dc2626',        // red-600
  checkpoint: '#ea580c',  // orange-600
  arrest: '#ca8a04',      // yellow-600
  surveillance: '#2563eb', // blue-600
  other: '#6b7280'        // gray-500
};

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  raid: 'Raid',
  checkpoint: 'Checkpoint',
  arrest: 'Arrest',
  surveillance: 'Surveillance',
  other: 'Other'
};
