/**
 * Shared badge color maps for status/category fields across the CRM.
 * Each value is a Tailwind className string to append to a Badge with variant="outline".
 */

export const contractStatusColors: Record<string, string> = {
  "To do":
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  "In process":
    "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  "In process - Past due":
    "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  "Stopped - Past due":
    "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  "In process - Paid":
    "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
  "Done - Paid":
    "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  Canceled:
    "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

export const accountCategoryColors: Record<string, string> = {
  "In Process":
    "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  Closed:
    "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  Archived:
    "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  "Consultation Only":
    "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
};

export const activityTypeColors: Record<string, string> = {
  call: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  email: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  meeting: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
  document: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  note: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  payment: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};
