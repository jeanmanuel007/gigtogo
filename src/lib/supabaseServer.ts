import type { APIContext } from "astro";

const supabaseUrl = import.meta.env.SUPABASE_URL;
const supabaseAnonKey = import.meta.env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;
const profileImageBucket = "profile-images";

const cookieOptions = {
  httpOnly: true,
  secure: import.meta.env.PROD,
  sameSite: "lax" as const,
  path: "/",
};

type SupabaseFetchOptions = {
  method?: string;
  token?: string;
  body?: unknown;
  prefer?: string;
  serviceRole?: boolean;
};

export type CurrentUser = {
  id: string;
  email: string;
  role: string;
};

export function hasSupabaseConfig() {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

export function missingSupabaseResponse() {
  return new Response("Supabase is not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY to .env.", {
    status: 500,
  });
}

export async function supabaseFetch(path: string, options: SupabaseFetchOptions = {}) {
  if (!hasSupabaseConfig()) {
    throw new Error("Missing Supabase environment variables.");
  }

  if (options.serviceRole && !supabaseServiceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY in .env.");
  }

  const apiKey = options.serviceRole ? supabaseServiceRoleKey : supabaseAnonKey;
  const authToken = options.serviceRole ? supabaseServiceRoleKey : options.token ?? supabaseAnonKey;

  const headers = new Headers({
    apikey: apiKey,
    Authorization: `Bearer ${authToken}`,
  });

  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  if (options.prefer) {
    headers.set("Prefer", options.prefer);
  }

  const response = await fetch(`${supabaseUrl}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = data?.msg ?? data?.message ?? data?.error_description ?? "Supabase request failed.";
    throw new Error(message);
  }

  return data;
}

async function createProfileImageBucket() {
  if (!supabaseServiceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY in .env.");
  }

  const response = await fetch(`${supabaseUrl}/storage/v1/bucket`, {
    method: "POST",
    headers: {
      apikey: supabaseServiceRoleKey,
      Authorization: `Bearer ${supabaseServiceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      id: profileImageBucket,
      name: profileImageBucket,
      public: true,
    }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    const message = data?.message ?? "";

    if (response.status !== 409 && !message.toLowerCase().includes("already exists")) {
      throw new Error(message || "Could not create profile image bucket.");
    }
  }
}

export async function uploadProfileImage(userId: string, file: File) {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("Supabase image upload is not configured.");
  }

  await createProfileImageBucket();

  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const safeExtension = extension.replace(/[^a-z0-9]/g, "") || "jpg";
  const imagePath = `${userId}/profile.${safeExtension}`;

  const response = await fetch(`${supabaseUrl}/storage/v1/object/${profileImageBucket}/${imagePath}`, {
    method: "PUT",
    headers: {
      apikey: supabaseServiceRoleKey,
      Authorization: `Bearer ${supabaseServiceRoleKey}`,
      "Content-Type": file.type || "application/octet-stream",
      "x-upsert": "true",
    },
    body: file,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.message ?? "Could not upload profile image.");
  }

  return `${supabaseUrl}/storage/v1/object/public/${profileImageBucket}/${imagePath}`;
}

export function setAuthCookies(context: APIContext, session: any, role = "worker") {
  const maxAge = session.expires_in ?? 60 * 60 * 24 * 7;

  context.cookies.set("gigtogo_access_token", session.access_token, {
    ...cookieOptions,
    maxAge,
  });
  context.cookies.set("gigtogo_refresh_token", session.refresh_token, {
    ...cookieOptions,
    maxAge: 60 * 60 * 24 * 30,
  });
  context.cookies.set("gigtogo_user_id", session.user.id, {
    ...cookieOptions,
    maxAge,
  });
  context.cookies.set("gigtogo_user_email", session.user.email ?? "", {
    ...cookieOptions,
    maxAge,
  });
  context.cookies.set("gigtogo_role", role, {
    ...cookieOptions,
    httpOnly: false,
    maxAge,
  });
}

export function setUserEmailCookie(context: APIContext, email: string) {
  context.cookies.set("gigtogo_user_email", email, {
    ...cookieOptions,
    maxAge: 60 * 60 * 24 * 7,
  });
}

export function clearAuthCookies(context: APIContext) {
  for (const name of [
    "gigtogo_access_token",
    "gigtogo_refresh_token",
    "gigtogo_user_id",
    "gigtogo_user_email",
    "gigtogo_role",
  ]) {
    context.cookies.delete(name, { path: "/" });
  }
}

export function getCurrentUser(context: APIContext): CurrentUser | null {
  const token = context.cookies.get("gigtogo_access_token")?.value;
  const id = context.cookies.get("gigtogo_user_id")?.value;
  const email = context.cookies.get("gigtogo_user_email")?.value;
  const role = context.cookies.get("gigtogo_role")?.value ?? "worker";

  if (!token || !id || !email) {
    return null;
  }

  return { id, email, role };
}

export function getAccessToken(context: APIContext) {
  return context.cookies.get("gigtogo_access_token")?.value ?? null;
}

export function redirectTo(path: string, status = 303) {
  return new Response(null, {
    status,
    headers: { Location: path },
  });
}

export function redirectWithMessage(path: string, key: string, message: string) {
  const url = new URL(path, "https://gigtogo.local");
  url.searchParams.set(key, message);
  return redirectTo(`${url.pathname}${url.search}`);
}
