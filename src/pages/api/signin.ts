import type { APIRoute } from "astro";
import {
  hasSupabaseConfig,
  missingSupabaseResponse,
  redirectWithMessage,
  setAuthCookies,
  supabaseFetch,
} from "../../lib/supabaseServer";

export const POST: APIRoute = async (context) => {
  if (!hasSupabaseConfig()) {
    return missingSupabaseResponse();
  }

  const form = await context.request.formData();
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");

  if (!email || !password) {
    return redirectWithMessage("/auth/signin", "error", "Please enter your email and password.");
  }

  try {
    const session = await supabaseFetch("/auth/v1/token?grant_type=password", {
      method: "POST",
      body: { email, password },
    });

    const profile = await supabaseFetch(
      `/rest/v1/profiles?id=eq.${session.user.id}&select=role&limit=1`,
      { token: session.access_token }
    );
    const role = profile?.[0]?.role ?? session.user.user_metadata?.role ?? "worker";

    if (!profile?.[0]) {
      await supabaseFetch("/rest/v1/profiles?on_conflict=id", {
        method: "POST",
        token: session.access_token,
        prefer: "resolution=merge-duplicates,return=minimal",
        body: {
          id: session.user.id,
          email: session.user.email ?? email,
          full_name: session.user.user_metadata?.full_name ?? email.split("@")[0],
          role,
        },
      });
    }

    setAuthCookies(context, session, role);

    return new Response(null, {
      status: 303,
      headers: { Location: role === "business" ? "/business/dashboard" : "/worker/dashboard" },
    });
  } catch (error) {
    return redirectWithMessage(
      "/auth/signin",
      "error",
      error instanceof Error ? error.message : "Sign in failed."
    );
  }
};
