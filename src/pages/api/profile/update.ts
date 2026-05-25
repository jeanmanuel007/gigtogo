import type { APIRoute } from "astro";
import {
  getAccessToken,
  getCurrentUser,
  hasSupabaseConfig,
  missingSupabaseResponse,
  redirectWithMessage,
  supabaseFetch,
} from "../../../lib/supabaseServer";

const missingColumnPattern = /Could not find the '([^']+)' column/;

export const POST: APIRoute = async (context) => {
  if (!hasSupabaseConfig()) {
    return missingSupabaseResponse();
  }

  const user = getCurrentUser(context);
  const token = getAccessToken(context);

  if (!user || !token) {
    return redirectWithMessage("/auth/signin", "error", "Please sign in to update your profile.");
  }

  const form = await context.request.formData();
  const defaultBackTo = user.role === "business" ? "/business/profile" : "/worker/profile";
  const backToValue = String(form.get("back_to") ?? defaultBackTo);
  const backTo = backToValue.startsWith("/") ? backToValue : defaultBackTo;
  const fullName = String(form.get("full_name") ?? "").trim();
  const phone = String(form.get("phone") ?? "").trim();
  const location = String(form.get("location") ?? "").trim();
  const headline = String(form.get("headline") ?? "").trim();
  const bio = String(form.get("bio") ?? "").trim();
  const experience = String(form.get("experience") ?? "").trim();
  const availability = String(form.get("availability") ?? "").trim();
  const skills = String(form.get("skills") ?? "")
    .split(",")
    .map((skill) => skill.trim())
    .filter(Boolean);

  if (!fullName) {
    return redirectWithMessage(backTo, "error", "Please enter your name.");
  }

  const body: Record<string, unknown> = {
    full_name: fullName,
    phone,
    location,
    headline,
    bio,
    skills,
    experience,
    availability,
  };

  try {
    const missingColumns = new Set<string>();

    for (let attempt = 0; attempt < 8; attempt += 1) {
      try {
        await supabaseFetch(`/rest/v1/profiles?id=eq.${user.id}`, {
          method: "PATCH",
          token,
          prefer: "return=minimal",
          body: Object.fromEntries(Object.entries(body).filter(([key]) => !missingColumns.has(key))),
        });
        break;
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        const missingColumn = message.match(missingColumnPattern)?.[1];

        if (!missingColumn || missingColumn === "full_name") {
          throw error;
        }

        missingColumns.add(missingColumn);
      }
    }

    if (missingColumns.size > 0) {
      return redirectWithMessage(
        backTo,
        "notice",
        "Basic profile updated. Run supabase-profile-fields.sql in Supabase to save all profile fields."
      );
    }

    return redirectWithMessage(backTo, "notice", "Profile updated.");
  } catch (error) {
    return redirectWithMessage(
      backTo,
      "error",
      error instanceof Error ? error.message : "Could not update your profile."
    );
  }
};
