"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export class ApiClientError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.details = details;
  }
}

export async function authFetch<T>(input: RequestInfo | URL, init: RequestInit = {}) {
  const supabase = getSupabaseBrowserClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new ApiClientError("请先登录。", 401);

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(input, { ...init, headers });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiClientError(payload?.error ?? "请求失败。", response.status, payload?.details);
  }
  return payload as T;
}
