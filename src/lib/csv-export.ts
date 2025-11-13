/**
 * Utility functions for CSV export
 */

/**
 * Converts an array of objects to CSV format
 * @param data Array of objects to convert
 * @param headers Optional custom headers. If not provided, uses object keys
 * @returns CSV string
 */
export function convertToCSV(
  data: any[],
  headers?: { key: string; label: string }[]
): string {
  if (!data || data.length === 0) {
    return "";
  }

  // Use custom headers if provided, otherwise use object keys
  const csvHeaders = headers || Object.keys(data[0]);
  const headerLabels = headers
    ? headers.map((h) => h.label)
    : Object.keys(data[0]);

  // Create header row
  const headerRow = headerLabels
    .map((header) => escapeCSVValue(header))
    .join(",");

  // Create data rows
  const dataRows = data.map((row) => {
    return csvHeaders
      .map((header) => {
        const key = typeof header === "string" ? header : header.key;
        const value = getNestedValue(row, key);
        return escapeCSVValue(value);
      })
      .join(",");
  });

  return [headerRow, ...dataRows].join("\n");
}

/**
 * Escapes a value for CSV format
 */
function escapeCSVValue(value: any): string {
  if (value === null || value === undefined) {
    return "";
  }

  const stringValue = String(value);

  // If value contains comma, newline, or quote, wrap in quotes and escape quotes
  if (stringValue.includes(",") || stringValue.includes("\n") || stringValue.includes('"')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

/**
 * Gets a nested value from an object using dot notation
 */
function getNestedValue(obj: any, path: string): any {
  return path.split(".").reduce((current, prop) => {
    return current && current[prop] !== undefined ? current[prop] : null;
  }, obj);
}

/**
 * Downloads a CSV file
 * @param csvContent CSV string content
 * @param filename Filename for the download
 */
export function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Formats a date value for CSV
 */
export function formatDateForCSV(date: string | Date | null | undefined): string {
  if (!date) return "";
  try {
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toISOString().split("T")[0]; // YYYY-MM-DD format
  } catch {
    return String(date);
  }
}

/**
 * Formats a timestamp for CSV
 */
export function formatTimestampForCSV(
  timestamp: string | Date | null | undefined
): string {
  if (!timestamp) return "";
  try {
    const d = typeof timestamp === "string" ? new Date(timestamp) : timestamp;
    return d.toISOString();
  } catch {
    return String(timestamp);
  }
}

/**
 * Parses CSV content into an array of objects
 * @param csvContent CSV string content
 * @returns Array of objects with keys from header row
 */
export function parseCSV(csvContent: string): any[] {
  const lines = csvContent.split("\n").filter((line) => line.trim());
  if (lines.length < 2) return [];

  // Parse header
  const headers = parseCSVLine(lines[0]);

  // Parse data rows
  const data: any[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0) continue;

    const row: any = {};
    headers.forEach((header, index) => {
      row[header.trim()] = values[index]?.trim() || "";
    });
    data.push(row);
  }

  return data;
}

/**
 * Parses a single CSV line, handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      // End of value
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  // Add last value
  values.push(current);

  return values;
}

/**
 * Downloads a CSV template with only the specified headers
 * @param headers Array of header objects with key and label
 * @param filename Filename for the download
 */
export function downloadCSVTemplate(
  headers: { key: string; label: string }[],
  filename: string
): void {
  const headerRow = headers.map((h) => escapeCSVValue(h.label)).join(",");
  const csvContent = headerRow + "\n"; // Only headers, no data rows
  downloadCSV(csvContent, filename);
}

