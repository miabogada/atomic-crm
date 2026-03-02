import { createClient } from "@supabase/supabase-js";

// Capture the URL hash synchronously at module load time, before Supabase JS
// asynchronously processes and clears it via history.replaceState. This is
// needed to detect password recovery redirects in checkAuth / StartPage.
export const initialHash =
  typeof window !== "undefined" ? window.location.hash : "";

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SB_PUBLISHABLE_KEY,
);
