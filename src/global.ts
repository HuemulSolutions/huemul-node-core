export const globalStartDateISO = "1900-01-01";
export const globalEndDateISO = "2099-01-01";

export function sanitizeSqlText(text: string | undefined): string | undefined {
  if (!text) return text;
  return text.replace(/'/g, "''");
}