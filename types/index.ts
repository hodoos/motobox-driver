export type UserType = {
  id: string;
  email?: string;
  driver_name?: string;
  phone_number?: string;
};

export type DriverSettings = {
  driver_name: string;
  phone_number: string;
  unit_price: string;
  settlement_start_day: string;
  settlement_start_month_offset: string;
  settlement_end_day: string;
  settlement_end_month_offset: string;
  off_days: number[];
  biweekly_off_days: number[];
  biweekly_anchor_date: string;
};

export type AdditionalWorkItemForm = {
  key: string;
  unit_price: string;
  delivered_count: string;
  returned_count: string;
  canceled_count: string;
};

export type ReportForm = {
  report_date: string;
  delivered_count: string;
  returned_count: string;
  canceled_count: string;
  memo: string;
  is_day_off: boolean;
  unit_price_override: string;
  additional_works: AdditionalWorkItemForm[];
};

export type DailyReportRow = {
  id: number;
  user_id: string;
  report_date: string;
  delivered_count: number;
  returned_count: number;
  canceled_count: number;
  memo: string | null;
  daily_sales: number;
  is_day_off: boolean;
  unit_price_override: number | null;
};

export type AdminDriverSettingsRow = {
  user_id: string;
  driver_name: string | null;
  phone_number: string | null;
  unit_price: number | null;
};

export type AdminOverviewResponse = {
  driverSettingsRows: AdminDriverSettingsRow[];
  reports: DailyReportRow[];
};

export type CommunityPostStorageMode = "database" | "mixed" | "file-fallback";

export type CommunityPostRow = {
  id: string;
  board_key: "jobs" | "free-talk" | "notice" | "tips" | "affiliate";
  title: string;
  body: string;
  author_user_id: string;
  author_email: string | null;
  author_name: string | null;
  author_level: string;
  created_at: string;
  updated_at: string;
};

export type CommunityPostsResponse = {
  board_key: CommunityPostRow["board_key"];
  posts: CommunityPostRow[];
  storage: CommunityPostStorageMode;
};

export type CommunityPostMutationResponse = {
  post: CommunityPostRow;
  storage: Exclude<CommunityPostStorageMode, "mixed">;
};

export type StaffAuditLogRow = {
  id: string;
  actor_user_id: string;
  actor_email: string | null;
  actor_level: string;
  action: string;
  target_type: string;
  target_id: string | null;
  source: string | null;
  summary: string;
  details: Record<string, unknown>;
  created_at: string;
  actor_name?: string;
  target_name?: string;
  summary_short?: string;
};

export type StaffAuditLogResponse = {
  logs: StaffAuditLogRow[];
};