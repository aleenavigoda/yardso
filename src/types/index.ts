export interface TimeLoggingData {
  mode: 'helped' | 'wasHelped'
  hours: number
  name: string
  contact: string
  description: string
}

export interface Profile {
  id: string
  user_id: string
  email: string
  full_name?: string
  display_name?: string
  bio?: string
  location?: string
  timezone?: string
  avatar_url?: string
  is_available_for_work?: boolean
  hourly_rate_range?: string
  preferred_work_types?: string[]
  time_balance_hours?: number
  profile_completion_score?: number
  created_at?: string
  updated_at?: string
}

export interface ProfileUrl {
  id: string
  profile_id: string
  url: string
  url_type: string
  title?: string
  description?: string
  is_verified?: boolean
  scrape_status?: string
  scraped_at?: string
  created_at?: string
}

export interface Invitation {
  id: string
  inviter_id: string
  email: string
  phone?: string
  full_name: string
  invitation_type: string
  status: 'pending' | 'accepted' | 'expired' | 'cancelled'
  token: string
  expires_at: string
  accepted_at?: string
  created_at: string
  updated_at: string
}

export interface PendingTimeLog {
  id: string
  invitation_id?: string
  logger_profile_id: string
  invitee_email: string
  invitee_name: string
  invitee_contact?: string
  hours: number
  description?: string
  service_type?: string
  mode: 'helped' | 'wasHelped'
  status: 'pending' | 'converted' | 'expired' | 'cancelled'
  converted_transaction_id?: string
  created_at: string
  updated_at: string
}

export interface TimeTransaction {
  id: string
  giver_id: string
  receiver_id: string
  hours: number
  description?: string
  service_type?: string
  status: 'pending' | 'confirmed' | 'disputed' | 'cancelled'
  logged_by: string
  confirmed_at?: string
  confirmed_by?: string
  disputed_at?: string
  dispute_reason?: string
  created_at: string
  updated_at: string
}