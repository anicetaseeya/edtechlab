import { cache } from "react";
import { createClient } from "./server";
import { supabaseConfigured } from "./env";

/**
 * The logged-in user for this request.
 *
 * Wrapped in React's cache() so the layout and the page share one call to
 * Supabase instead of asking separately on every single page view.
 */
export const getCurrentUser = cache(async () => {
  if (!supabaseConfigured) return null;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  } catch {
    return null;
  }
});
