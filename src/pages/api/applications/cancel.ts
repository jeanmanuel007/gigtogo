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
  const backTo = String(form.get("back_to") ?? "/worker/applications");

  if (!applicationId || !shiftId) {
    return redirectWithMessage(backTo, "error", "Missing application details.");
  }

  try {
    const rows = await supabaseFetch(
      `/rest/v1/shift_applications?id=eq.${applicationId}&worker_id=eq.${user.id}&select=id,status&limit=1`,
      { token }
    );
    const application = rows?.[0];

    if (!application) {
      return redirectWithMessage(backTo, "error", "Could not find this application.");
    }

    const wasAccepted = String(application.status ?? "").toLowerCase() === "accepted";

    await supabaseFetch(`/rest/v1/shift_applications?id=eq.${applicationId}&worker_id=eq.${user.id}`, {
      method: "PATCH",
      token,
      prefer: "return=minimal",
      body: { status: "cancelled" },
    });

    if (wasAccepted) {
      await supabaseFetch(`/rest/v1/shifts?id=eq.${shiftId}&accepted_worker_id=eq.${user.id}`, {
        method: "PATCH",
        token,
        prefer: "return=minimal",
        body: {
          status: "open",
          accepted_worker_id: null,
        },
      });
    }

    return redirectWithMessage(backTo, "notice", wasAccepted ? "Shift cancelled." : "Application cancelled.");
  } catch (error) {
    return redirectWithMessage(
      backTo,
      "error",
      error instanceof Error ? error.message : "Could not cancel this application."
    );
  }
};
