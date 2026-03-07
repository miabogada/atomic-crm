/**
 * Phone formatting utilities for US phone numbers.
 * Storage format: E.164 (+15551234567)
 * Display format: (555) 123-4567
 */

/** Strip all non-digit characters and cap at 10 digits (excluding leading country code 1) */
export const parsePhoneDigits = (value: string): string => {
  let digits = value.replace(/\D/g, "");
  // Strip leading 1 country code if more than 10 digits
  if (digits.startsWith("1") && digits.length > 10) digits = digits.slice(1);
  return digits.slice(0, 10);
};

/** Format a digit string (already capped at 10) as (XXX) XXX-XXXX */
export const formatPhoneDisplay = (digits: string): string => {
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
};

/** Convert a digit string to E.164 format for storage */
export const toE164 = (digits: string): string => {
  if (digits.length === 10) return `+1${digits}`;
  return digits; // Return as-is if not a valid 10-digit number
};

/** Parse an E.164 or raw phone string for display */
export const phoneToDisplay = (value: string | null | undefined): string => {
  if (!value) return "";
  const digits = parsePhoneDigits(value);
  return formatPhoneDisplay(digits);
};
