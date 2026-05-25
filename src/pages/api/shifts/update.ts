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
    return redirectWithMessage("/auth/signin", "error", "Please sign in to edit a shift.");
  }

  const form = await context.request.formData();
  const shiftId = String(form.get("shift_id") ?? "").trim();
  const title = String(form.get("title") ?? "").trim();
  const location = String(form.get("location") ?? "").trim();
  const shiftDate = String(form.get("shift_date") ?? "");
  const startTime = String(form.get("start_time") ?? "");
  const endTime = String(form.get("end_time") ?? "");
  const payRate = Number(form.get("pay_rate"));
  const shiftType = String(form.get("shift_type") ?? "Flexible").trim();
  const status = String(form.get("status") ?? "open").trim();
  const description = String(form.get("description") ?? "").trim();

  if (!shiftId || !title || !location || !shiftDate || !startTime || !endTime || !payRate) {
    return redirectWithMessage(`/business/shifts/edit/${shiftId || ""}`, "error", "Please complete all required shift fields.");
  }

  try {
    const profileRows = await supabaseFetch(
      `/rest/v1/profiles?id=eq.${user.id}&select=full_name&limit=1`,
      { token }
    );
    const company = profileRows?.[0]?.full_name ?? "Business";

    await supabaseFetch(`/rest/v1/shifts?id=eq.${shiftId}&business_id=eq.${user.id}`, {
      method: "PATCH",
      token,
      prefer: "return=minimal",
      body: {
        title,
        company,
        location,
        shift_date: shiftDate,
        start_time: startTime,
        end_time: endTime,
        pay_rate: payRate,
        shift_type: shiftType,
        status,
        description,
      },
    });

    return redirectWithMessage("/business/shifts", "notice", "Shift updated successfully.");
  } catch (error) {
    return redirectWithMessage(
      `/business/shifts/edit/${shiftId}`,
      "error",
      error instanceof Error ? error.message : "Could not update shift."
    );
  }
};
