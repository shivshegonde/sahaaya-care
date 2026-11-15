export interface User {
  id: string;
  email: string;
  displayName: string;
  preferredLanguage?: string;
  roleTitle?: string;
}

export interface CareProfile {
  id: string;
  owner_user_id: string;
  display_name: string;
  timezone: string;
  preferred_language: string;
  grace_period_minutes: number;
}

export interface Membership {
  id: string;
  care_profile_id: string;
  user_id: string;
  role: 'ELDER_OWNER' | 'FAMILY_ADMIN' | 'FAMILY_MEMBER' | 'CARETAKER' | 'CARE_COORDINATOR';
  permissions: string[];
  status: 'ACTIVE' | 'REVOKED';
  display_name?: string;
  email?: string;
  role_title?: string;
}

export interface Medication {
  id: string;
  care_profile_id: string;
  name: string;
  brand_name?: string;
  dose_text: string;
  form: string;
  route?: string;
  instructions?: string;
  schedule_type: string;
  schedule_config: {
    times: string[];
    days?: string[];
  };
  start_date: string;
  end_date?: string;
  timezone: string;
  status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
  prescriber?: string;
  version: number;
}

export interface DoseInstance {
  id: string;
  care_profile_id: string;
  medication_id: string;
  medication_name: string;
  brand_name?: string;
  dose_text: string;
  form: string;
  instructions?: string;
  scheduled_at_utc: string;
  local_scheduled_at: string;
  timezone: string;
  status: 'UPCOMING' | 'DUE' | 'ACKNOWLEDGED_TAKEN' | 'ACKNOWLEDGED_SKIPPED' | 'UNABLE_TO_TAKE' | 'OVERDUE_UNCONFIRMED' | 'CANCELLED';
  grace_period_minutes: number;
  acknowledged_at?: string;
  acknowledged_by?: string;
  acknowledged_by_name?: string;
  acknowledgement_note?: string;
}

export interface Appointment {
  id: string;
  care_profile_id: string;
  doctor_name: string;
  specialty?: string;
  facility_name: string;
  address?: string;
  contact_number?: string;
  starts_at_utc: string;
  timezone: string;
  appointment_type: string;
  notes?: string;
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'RESCHEDULED';
}

export interface CareNote {
  id: string;
  care_profile_id: string;
  author_user_id: string;
  author_name?: string;
  author_email?: string;
  category: 'GENERAL' | 'APPOINTMENT' | 'MEDICATION_OBSERVATION' | 'FOLLOW_UP';
  body: string;
  visibility: 'ALL_MEMBERS' | 'FAMILY_ONLY' | 'CARETAKER_ONLY';
  created_at: string;
}

export interface AdherenceData {
  careProfileId: string;
  dateRange: {
    start: string;
    end: string;
    days: number;
  };
  metrics: {
    totalEligiblePastDoses: number;
    acknowledgedTaken: number;
    acknowledgedSkipped: number;
    unableToTake: number;
    overdueUnconfirmed: number;
    adherenceRatePercentage: number;
  };
  dailyBreakdown: Array<{
    date: string;
    total: number;
    taken: number;
    skipped: number;
    unconfirmed: number;
  }>;
  methodology: {
    definition: string;
    disclaimer: string;
  };
}

export interface NotificationDelivery {
  id: string;
  notification_event_id: string;
  recipient_name: string;
  recipient_email: string;
  subject: string;
  body_text: string;
  provider: string;
  status: 'QUEUED' | 'SENT' | 'DELIVERED' | 'FAILED' | 'RETRYING';
  event_type: string;
  created_at: string;
  sent_at?: string;
}

export interface AuditEvent {
  id: string;
  action: string;
  actor_name?: string;
  actor_email?: string;
  entity_type: string;
  entity_id: string;
  reason?: string;
  created_at: string;
}
