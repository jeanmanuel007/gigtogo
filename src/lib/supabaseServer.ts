import type { APIContext } from "astro";

const supabaseUrl = import.meta.env.SUPABASE_URL;
const supabaseAnonKey = import.meta.env.SUPABASE_ANON_KEY;

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

  const headers = new Headers({
    apikey: supabaseAnonKey,
    Authorization: `Bearer ${options.token ?? supabaseAnonKey}`,
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
