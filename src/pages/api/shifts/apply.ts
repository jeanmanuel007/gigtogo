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
    const existingRows = await supabaseFetch(
      `/rest/v1/shift_applications?shift_id=eq.${shiftId}&worker_id=eq.${user.id}&select=id,status&limit=1`,
      { token }
    );
    const existingApplication = existingRows?.[0];

    if (existingApplication) {
      const status = String(existingApplication.status ?? "").toLowerCase();

      if (status === "accepted") {
        return redirectWithMessage(backTo, "notice", "This shift has already been accepted and is on your dashboard.");
      }

      if (status === "pending") {
        return redirectWithMessage(backTo, "notice", "You have already applied for this shift.");
      }

      await supabaseFetch(`/rest/v1/shift_applications?id=eq.${existingApplication.id}&worker_id=eq.${user.id}`, {
        method: "PATCH",
        token,
        prefer: "return=minimal",
        body: {
          status: "pending",
          note,
        },
      });

      return redirectWithMessage(
        backTo,
        "notice",
        "Application sent again. The business will review your application and accept it if it is a match."
      );
    }

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

    return redirectWithMessage(
      backTo,
      "notice",
      "Application sent. The business will review your application and accept it if it is a match."
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "";

    if (message.includes("duplicate key") || message.includes("shift_applications_shift_id_worker_id_key")) {
      return redirectWithMessage(backTo, "notice", "You have already applied for this shift.");
    }

    return redirectWithMessage(
      backTo,
      "error",
      message || "Could not apply for this shift."
    );
  }
};
