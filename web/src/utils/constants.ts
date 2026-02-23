export const APP_NAME = "ERP eCommerce";
export const APP_DESCRIPTION = "Enterprise Commerce Management Platform";

export const PRODUCT_STATUSES = [
  { label: "Active", value: "active" },
  { label: "Draft", value: "draft" },
  { label: "Archived", value: "archived" },
] as const;

export const PRODUCT_CATEGORIES = [
  { label: "Electronics", value: "electronics" },
  { label: "Clothing", value: "clothing" },
  { label: "Home & Garden", value: "home-garden" },
  { label: "Sports & Outdoors", value: "sports" },
  { label: "Books & Media", value: "books" },
  { label: "Health & Beauty", value: "health" },
  { label: "Food & Beverages", value: "food" },
  { label: "Automotive", value: "automotive" },
] as const;

export const ORDER_STATUSES = [
  { label: "Pending", value: "pending" },
  { label: "Confirmed", value: "confirmed" },
  { label: "Shipped", value: "shipped" },
  { label: "Delivered", value: "delivered" },
  { label: "Cancelled", value: "cancelled" },
] as const;

export const PAYMENT_STATUSES = [
  { label: "Pending", value: "pending" },
  { label: "Paid", value: "paid" },
  { label: "Refunded", value: "refunded" },
] as const;

export const CUSTOMER_SEGMENTS = [
  { label: "VIP", value: "vip" },
  { label: "Regular", value: "regular" },
  { label: "New", value: "new" },
  { label: "At Risk", value: "at-risk" },
  { label: "Churned", value: "churned" },
] as const;

export const CURRENCIES = [
  { label: "USD - US Dollar", value: "USD" },
  { label: "EUR - Euro", value: "EUR" },
  { label: "GBP - British Pound", value: "GBP" },
  { label: "NGN - Nigerian Naira", value: "NGN" },
  { label: "CAD - Canadian Dollar", value: "CAD" },
] as const;

export const DATE_FORMAT = "YYYY-MM-DD";
export const DATETIME_FORMAT = "YYYY-MM-DD HH:mm:ss";
export const PAGE_SIZE = 10;
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
