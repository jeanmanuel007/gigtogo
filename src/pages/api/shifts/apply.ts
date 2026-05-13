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
    return redirectWithMessage("/auth/signin", "error", "Please sign in to apply for a shift.");
  }

  const form = await context.request.formData();
  const shiftId = String(form.get("shift_id") ?? "").trim();
  const note = String(form.get("note") ?? "").trim();
  const backTo = String(form.get("back_to") ?? "/worker/shifts");

  if (!shiftId) {
    return redirectWithMessage("/worker/shifts", "error", "Missing shift id.");
  }

  try {
    await supabaseFetch("/rest/v1/shift_applications", {
      method: "POST",
      token,
      prefer: "return=minimal",
      body: {
        shift_id: shiftId,
        worker_id: user.id,
        note,
      },
    });

    return redirectWithMessage(backTo, "notice", "Application sent.");
  } catch (error) {
    return redirectWithMessage(
      backTo,
      "error",
      error instanceof Error ? error.message : "Could not apply for this shift."
    );
  }
};
