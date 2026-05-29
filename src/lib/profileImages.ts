import { hasSupabaseConfig, supabaseFetch } from "./supabaseServer";

const defaultProfileImage = "/GigToGo_logo.svg";
const defaultCoverImage = "/business-default-1.jpg";

export function getProfileImage(uploadedImage = "") {
  return uploadedImage || defaultProfileImage;
}

export function getCoverImage() {
  return defaultCoverImage;
}

export async function getUserProfileImage(token?: string, userId?: string) {
  if (!hasSupabaseConfig() || !token || !userId) {
    return getProfileImage();
  }

  try {
    const rows = await supabaseFetch(
      `/rest/v1/profiles?id=eq.${userId}&select=profile_image_path&limit=1`,
      { token }
    );

    return getProfileImage(rows?.[0]?.profile_image_path);
  } catch {
    return getProfileImage();
  }
}
