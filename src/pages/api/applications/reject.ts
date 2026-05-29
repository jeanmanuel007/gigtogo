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

  if (!applicationId) {
    return redirectWithMessage("/business/applications", "error", "Missing application details.");
  }

  try {
    const rows = await supabaseFetch(
      `/rest/v1/shift_applications?id=eq.${applicationId}&select=id,status,shift_id,worker_id,shifts!inner(business_id)&shifts.business_id=eq.${user.id}&limit=1`,
      { token }
    );
    const application = rows?.[0];

    if (!application) {
      return redirectWithMessage("/business/applications", "error", "Could not find this application.");
    }

    const wasAccepted = String(application.status ?? "").toLowerCase() === "accepted";

    await supabaseFetch(`/rest/v1/shift_applications?id=eq.${applicationId}`, {
      method: "PATCH",
      token,
      prefer: "return=minimal",
      body: { status: "rejected" },
    });

    if (wasAccepted) {
      const resolvedShiftId = shiftId || application.shift_id;
      const resolvedWorkerId = workerId || application.worker_id;

      await supabaseFetch(
        `/rest/v1/shifts?id=eq.${resolvedShiftId}&business_id=eq.${user.id}&accepted_worker_id=eq.${resolvedWorkerId}`,
        {
          method: "PATCH",
          token,
          prefer: "return=minimal",
          body: {
            status: "open",
            accepted_worker_id: null,
          },
        }
      );
    }

    return redirectWithMessage(
      "/business/applications",
      "notice",
      "Application rejected."
    );
  } catch (error) {
    return redirectWithMessage(
      "/business/applications",
      "error",
      error instanceof Error ? error.message : "Could not reject application."
    );
  }
};
