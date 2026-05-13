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
    return redirectWithMessage("/auth/signin", "error", "Please sign in to post a shift.");
  }

  const form = await context.request.formData();
  const title = String(form.get("title") ?? "").trim();
  const company = String(form.get("company") ?? "").trim();
  const location = String(form.get("location") ?? "").trim();
  const shiftDate = String(form.get("shift_date") ?? "");
  const startTime = String(form.get("start_time") ?? "");
  const endTime = String(form.get("end_time") ?? "");
  const payRate = Number(form.get("pay_rate"));
  const shiftType = String(form.get("shift_type") ?? "Flexible").trim();
  const description = String(form.get("description") ?? "").trim();

  if (!title || !company || !location || !shiftDate || !startTime || !endTime || !payRate) {
    return redirectWithMessage("/business/create-shift", "error", "Please complete all required shift fields.");
  }

  try {
    await supabaseFetch("/rest/v1/shifts", {
      method: "POST",
      token,
      prefer: "return=minimal",
      body: {
        business_id: user.id,
        title,
        company,
        location,
        shift_date: shiftDate,
        start_time: startTime,
        end_time: endTime,
        pay_rate: payRate,
        shift_type: shiftType,
        description,
      },
    });

    return redirectWithMessage("/business/shifts", "notice", "Shift posted successfully.");
  } catch (error) {
    return redirectWithMessage(
      "/business/create-shift",
      "error",
      error instanceof Error ? error.message : "Could not post shift."
    );
  }
};
