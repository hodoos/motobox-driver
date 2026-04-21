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