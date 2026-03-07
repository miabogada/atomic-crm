/**
 * Phone formatting utilities for US phone numbers.
 * Storage format: E.164 (+15551234567)
 * Display format: (555) 123-4567
 */

/** Strip all non-digit characters from input */
export const parsePhoneDigits = (value: string): string =>
  value.replace(/\D/g, "");

/** Format a digit string as (XXX) XXX-XXXX as the user types */
export const formatPhoneDisplay = (digits: string): string => {
  // Strip leading 1 if present (country code)
  const d = digits.startsWith("1") && digits.length > 10 ? digits.slice(1) : digits;
  if (d.length <= 3) return d;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6, 10)}`;
};

/** Convert a digit string to E.164 format for storage */
export const toE164 = (digits: string): string => {
  const d = digits.startsWith("1") && digits.length > 10 ? digits.slice(1) : digits;
  if (d.length === 10) return `+1${d}`;
  return d; // Return as-is if not a valid 10-digit number
};

/** Parse an E.164 or raw phone string for display */
export const phoneToDisplay = (value: string | null | undefined): string => {
  if (!value) return "";
  const digits = parsePhoneDigits(value);
  return formatPhoneDisplay(digits);
};
