export type UserType = {
  id: string;
  email?: string;
  login_id?: string;
  driver_name?: string;
  phone_number?: string;
  signup_type?: "driver" | "vendor";
  is_coupang?: boolean;
};

export type AccountSettings = {
  login_id: string;
  email: string;
  driver_name: string;
  phone_number: string;
  signup_type: "driver" | "vendor";
  is_coupang: boolean;
  unit_price: string;
  settlement_start_day: string;
  settlement_start_month_offset: string;
  settlement_end_day: string;
  settlement_end_month_offset: string;
  off_days: number[];
  biweekly_off_days: number[];
  biweekly_anchor_date: string;
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

export type FreshbackRecoveryItemForm = {
  key: string;
  unit_price: string;
  quantity: string;
};

export type ExpenseItemForm = {
  key: string;
  description: string;
  amount: string;
};

export type ReportForm = {
  report_date: string;
  delivered_count: string;
  returned_count: string;
  canceled_count: string;
  include_canceled_in_sales: boolean;
  memo: string;
  is_day_off: boolean;
  unit_price_override: string;
  additional_works: AdditionalWorkItemForm[];
  freshback_recovery_items: FreshbackRecoveryItemForm[];
  expense_items: ExpenseItemForm[];
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

export type AdminUserLevel = "기사Lv" | "벤더Lv" | "Lv3-제휴" | "관리자Lv" | "운영자Lv";

export type AdminManagedUserRow = {
  user_id: string;
  email: string | null;
  driver_name: string | null;
  phone_number: string | null;
  last_sign_in_at: string | null;
  last_web_activity_at: string | null;
  unit_price: number | null;
  current_user_level: AdminUserLevel;
  is_legacy_admin: boolean;
};

export type AdminUsersResponse = {
  users: AdminManagedUserRow[];
};

export type AdminUserLevelUpdateResponse = {
  user: AdminManagedUserRow;
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

export type MenuVisibilityKey =
  | "basic"
  | "admin"
  | "dashboard"
  | "community"
  | "affiliate"
  | "vendor";

export type MenuAccessLevel = "authenticated" | AdminUserLevel;

export type MenuWriteAccessLevel = "disabled" | MenuAccessLevel;

export type MenuVisibilityItemKey =
  | "admin"
  | "dashboard"
  | "my-page"
  | "today-quick-card"
  | "work-summary"
  | "stats"
  | "daily-sales-list"
  | "work-calendar"
  | "jobs"
  | "free-talk"
  | "notice"
  | "tips"
  | "affiliate"
  | "vendor-home";

export type MenuVisibilityCategorySettings = {
  visible: boolean;
  enabled: boolean;
  label: string;
  order: number;
  access_level: MenuAccessLevel;
  write_access_level: MenuWriteAccessLevel;
};

export type MenuVisibilityCategorySettingsMap = Record<
  MenuVisibilityKey,
  MenuVisibilityCategorySettings
>;

export type MenuVisibilityItemSettingsEntry = {
  visible: boolean;
  enabled: boolean;
  label: string;
  order: number;
  access_level: MenuAccessLevel;
  write_access_level: MenuWriteAccessLevel;
};

export type MenuVisibilityItemSettings = Record<
  MenuVisibilityItemKey,
  MenuVisibilityItemSettingsEntry
>;

export type MenuVisibilitySettings = {
  categories: MenuVisibilityCategorySettingsMap;
  items: MenuVisibilityItemSettings;
};

export type MenuVisibilityCategorySettingsPatch = Partial<MenuVisibilityCategorySettings>;

export type MenuVisibilityItemSettingsPatch = Partial<MenuVisibilityItemSettingsEntry>;

export type MenuVisibilitySettingsPatch = {
  categories?: Partial<Record<MenuVisibilityKey, MenuVisibilityCategorySettingsPatch>>;
  items?: Partial<Record<MenuVisibilityItemKey, MenuVisibilityItemSettingsPatch>>;
};

export type MenuVisibilitySettingsResponse = {
  settings: MenuVisibilitySettings;
  updated_at: string | null;
};