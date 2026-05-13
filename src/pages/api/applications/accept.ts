import type { APIRoute } from "astro";
import {
  getAccessToken,
  getCurrentUser,
  hasSupabaseConfig,
  missingSupabaseResponse,
  redirectWithMessage,
  supabaseFetch,
} from "../../../lib/supabaseServer";

export const POST: APIRoute = async (context) => {
  if (!hasSupabaseConfig()) {
    return missingSupabaseResponse();
  }

  const user = getCurrentUser(context);
  const token = getAccessToken(context);

  if (!user || !token) {
    return redirectWithMessage("/auth/signin", "error", "Please sign in to manage applications.");
  }

  const form = await context.request.formData();
  const applicationId = String(form.get("application_id") ?? "").trim();
  const shiftId = String(form.get("shift_id") ?? "").trim();
  const workerId = String(form.get("worker_id") ?? "").trim();

  if (!applicationId || !shiftId || !workerId) {
    return redirectWithMessage("/business/applications", "error", "Missing application details.");
  }

  try {
    await supabaseFetch(`/rest/v1/shift_applications?id=eq.${applicationId}`, {
      method: "PATCH",
      token,
      prefer: "return=minimal",
      body: { status: "accepted" },
    });

    await supabaseFetch(`/rest/v1/shifts?id=eq.${shiftId}`, {
      method: "PATCH",
      token,
      prefer: "return=minimal",
      body: {
        status: "assigned",
        accepted_worker_id: workerId,
      },
    });

    return redirectWithMessage("/business/applications", "notice", "Application accepted.");
  } catch (error) {
    return redirectWithMessage(
      "/business/applications",
      "error",
      error instanceof Error ? error.message : "Could not accept application."
    );
  }
};
