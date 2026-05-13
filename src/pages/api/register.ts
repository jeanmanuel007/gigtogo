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
  const fullName = String(form.get("full_name") ?? "").trim();
  const role = String(form.get("role") ?? "worker");

  if (!email || !password || !fullName) {
    return redirectWithMessage("/auth/register", "error", "Please fill in all required fields.");
  }

  try {
    const data = await supabaseFetch("/auth/v1/signup", {
      method: "POST",
      body: {
        email,
        password,
        data: {
          full_name: fullName,
          role,
        },
      },
    });

    if (data.session) {
      setAuthCookies(context, data.session, role);

      await supabaseFetch("/rest/v1/profiles?on_conflict=id", {
        method: "POST",
        token: data.session.access_token,
        prefer: "resolution=merge-duplicates,return=minimal",
        body: {
          id: data.user.id,
          email,
          full_name: fullName,
          role,
        },
      });

      return new Response(null, {
        status: 303,
        headers: { Location: role === "business" ? "/business/dashboard" : "/worker/dashboard" },
      });
    }

    return redirectWithMessage(
      "/auth/signin",
      "notice",
      "Account created. Please check your email if confirmation is enabled, then sign in."
    );
  } catch (error) {
    return redirectWithMessage(
      "/auth/register",
      "error",
      error instanceof Error ? error.message : "Registration failed."
    );
  }
};
