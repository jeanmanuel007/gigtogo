import type { APIRoute } from "astro";
import {
  getAccessToken,
  getCurrentUser,
  hasSupabaseConfig,
  missingSupabaseResponse,
  redirectWithMessage,
  setUserEmailCookie,
  supabaseFetch,
  uploadProfileImage,
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
  const email = String(form.get("email") ?? user.email).trim();
  const newPassword = String(form.get("new_password") ?? "").trim();
  const profileImage = form.get("profile_image");
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

  if (!email) {
    return redirectWithMessage(backTo, "error", "Please enter your email.");
  }

  if (newPassword && newPassword.length < 6) {
    return redirectWithMessage(backTo, "error", "Password must be at least 6 characters.");
  }

  if (profileImage instanceof File && profileImage.size > 0 && !profileImage.type.startsWith("image/")) {
    return redirectWithMessage(backTo, "error", "Please upload an image file.");
  }

  if (profileImage instanceof File && profileImage.size > 3 * 1024 * 1024) {
    return redirectWithMessage(backTo, "error", "Profile image must be smaller than 3MB.");
  }

  const body: Record<string, unknown> = {
    full_name: fullName,
    email,
    phone,
    location,
    headline,
    bio,
    skills,
    experience,
    availability,
  };

  try {
    if (profileImage instanceof File && profileImage.size > 0) {
      body.profile_image_path = await uploadProfileImage(user.id, profileImage);
    }

    const emailChanged = email.toLowerCase() !== user.email.toLowerCase();

    if (emailChanged || newPassword) {
      const authBody: Record<string, string | boolean> = {};

      if (emailChanged) {
        authBody.email = email;
        authBody.email_confirm = true;
      }

      if (newPassword) {
        authBody.password = newPassword;
      }

      await supabaseFetch(`/auth/v1/admin/users/${user.id}`, {
        method: "PUT",
        serviceRole: true,
        body: authBody,
      });

      if (emailChanged) {
        setUserEmailCookie(context, email);
      }
    }

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
        "Profile updated. Some extra details will save after the profile fields are added in Supabase."
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
