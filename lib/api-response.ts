import { NextResponse } from "next/server";
import { ApiError } from "@/lib/supabase/data";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function fail(message: string, status = 400, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status });
}

export function failFromError(error: unknown) {
  if (error instanceof ApiError) {
    return fail(error.message, error.status, error.details);
  }
  const message = error instanceof Error ? error.message : "请求失败。";
  return fail(message, 500);
}
