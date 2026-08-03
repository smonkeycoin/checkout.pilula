"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export type AdminAuthErrorCode = "NO_SESSION" | "SESSION_EXPIRED";

export class AdminAuthError extends Error {
  code: AdminAuthErrorCode;

  constructor(code: AdminAuthErrorCode) {
    super(code);
    this.name = "AdminAuthError";
    this.code = code;
  }
}

type AdminFetchInit = Omit<RequestInit, "body"> & {
  body?: BodyInit | Record<string, unknown> | null;
};

function buildBody(body: AdminFetchInit["body"]) {
  if (!body || typeof body === "string" || body instanceof Blob || body instanceof FormData || body instanceof URLSearchParams) {
    return body as BodyInit | null | undefined;
  }
  return JSON.stringify(body);
}

async function getAccessToken() {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { session }
  } = await supabase?.auth.getSession() || { data: { session: null } };
  if (!session?.access_token) throw new AdminAuthError("NO_SESSION");
  return { supabase, accessToken: session.access_token };
}

async function redirectExpired(reason?: string) {
  const supabase = createSupabaseBrowserClient();
  await supabase?.auth.signOut();
  if (typeof window !== "undefined") {
    const error = reason === "email_not_allowed" ? "unauthorized" : "session_expired";
    window.location.assign(`/admin/login?error=${error}`);
  }
}

async function requestWithToken(input: RequestInfo | URL, init: AdminFetchInit | undefined, accessToken: string) {
  const headers = new Headers(init?.headers || {});
  headers.set("Authorization", `Bearer ${accessToken}`);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  return fetch(input, {
    ...init,
    body: buildBody(init?.body),
    credentials: "same-origin",
    headers
  });
}

async function readAuthReason(response: Response) {
  try {
    const clone = response.clone();
    const payload = (await clone.json()) as { reason?: string };
    return payload.reason;
  } catch {
    return undefined;
  }
}

export async function adminFetch(input: RequestInfo | URL, init?: AdminFetchInit) {
  const { supabase, accessToken } = await getAccessToken();
  const response = await requestWithToken(input, init, accessToken);
  if (response.status !== 401) return response;

  const {
    data: { session }
  } = await supabase?.auth.refreshSession() || { data: { session: null } };

  if (session?.access_token) {
    const retry = await requestWithToken(input, init, session.access_token);
    if (retry.status !== 401) return retry;
    await redirectExpired(await readAuthReason(retry));
    throw new AdminAuthError("SESSION_EXPIRED");
  }

  await redirectExpired(await readAuthReason(response));
  throw new AdminAuthError("SESSION_EXPIRED");
}

export async function downloadAdminCsv(endpoint: string, filename: string) {
  const response = await adminFetch(endpoint);
  if (!response.ok) throw new Error("No se pudo exportar el CSV.");
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
