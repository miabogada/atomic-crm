/** Convert a string to title case (capitalize first letter of each word) */
export const toTitleCase = (value: string): string =>
  value
    .toLowerCase()
    .replace(/(?:^|\s)\S/g, (char) => char.toUpperCase());
