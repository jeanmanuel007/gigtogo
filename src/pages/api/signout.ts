import type { APIRoute } from "astro";
import {
  clearAuthCookies,
  getAccessToken,
  hasSupabaseConfig,
  redirectTo,
  supabaseFetch,
} from "../../lib/supabaseServer";

export const POST: APIRoute = async (context) => {
  const token = getAccessToken(context);

  if (hasSupabaseConfig() && token) {
    try {
      await supabaseFetch("/auth/v1/logout", {
        method: "POST",
        token,
      });
    } catch {
      // Still clear local cookies if Supabase already expired the session.
    }
  }

  clearAuthCookies(context);
  return redirectTo("/auth/signin");
};

export const GET: APIRoute = async (context) => {
  clearAuthCookies(context);
  return redirectTo("/auth/signin");
};
