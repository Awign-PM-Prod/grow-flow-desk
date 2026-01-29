import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a number with comma separators for thousands
 * @param value - The number to format
 * @returns Formatted string with commas (e.g., 1234567 -> "1,234,567")
 */
export function formatNumber(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return "0";
  const num = typeof value === "string" ? parseFloat(value) || 0 : value;
  if (isNaN(num)) return "0";
  return num.toLocaleString("en-US");
}