import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

export function formatDate(date: string | Date | undefined | null): string {
  if (!date) return "N/A";
  return dayjs(date).format("MMM DD, YYYY");
}

export function formatDateTime(date: string | Date | undefined | null): string {
  if (!date) return "N/A";
  return dayjs(date).format("MMM DD, YYYY HH:mm");
}

export function formatRelativeTime(date: string | Date | undefined | null): string {
  if (!date) return "N/A";
  return dayjs(date).fromNow();
}

export function formatNumber(num: number | undefined | null): string {
  if (num === undefined || num === null) return "0";
  return new Intl.NumberFormat("en-US").format(num);
}

export function formatCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatPercentage(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
}

export function capitalizeFirst(str: string): string {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function formatStatus(status: string): string {
  return status
    .split(/[_-]/)
    .map((word) => capitalizeFirst(word))
    .join(" ");
}

export function formatOrderNumber(orderNumber: string): string {
  return orderNumber.startsWith("#") ? orderNumber : `#${orderNumber}`;
}
