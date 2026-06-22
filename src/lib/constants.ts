// App-wide constants for the OHI Expense Hub prototype.

export const APP_NAME = "OHI Expense Hub";
export const APP_SHORT_NAME = "OHI Expense";

/** Fallback mileage reimbursement rate (USD per mile) when no SystemSettings row exists. */
export const MILEAGE_RATE = 0.725;

/** localStorage key for the persisted mock database. */
export const STORAGE_KEY = "ohi-prototype-data";

/** Well-known keys in the SystemSettings key-value store. */
export const SETTING_KEYS = {
  appVersion: "appVersion",
  announcement: "announcementMessage",
  analyticsRetentionDays: "analyticsRetentionDays",
  mileageRate: "mileageRate",
} as const;

/** Default analytics data retention in days (1 year). */
export const DEFAULT_ANALYTICS_RETENTION_DAYS = 365;

/** Cookie name used by middleware to identify the current user. */
export const SESSION_COOKIE = "ohi-user-id";

/** Fallback app version when the SystemSettings row is missing. */
export const DEFAULT_APP_VERSION = "1.0.0";

/** Brand palette — "Deep Harbor" navy (matches the --primary token). */
export const BRAND_BLUE = "#0B2545";

/** Categorical chart palette (brand navy + gold + supporting accent hues). */
export const CHART_PALETTE = [
  "#0B2545", "#C8A02E", "#1E7A5A", "#C98A1E", "#B23A48",
  "#13315C", "#5B8FC9", "#7C9A92", "#9B6A6C", "#3E6B89",
];
