import { corsHeaders } from "./cors";

export function ok<T>(data: T, init?: ResponseInit) {
  const headers = { ...corsHeaders, ...init?.headers };
  return Response.json(data, { ...init, headers });
}

export function fail(message: string, status = 400, details?: unknown) {
  return Response.json(
    { error: message, ...(details !== undefined ? { details } : {}) },
    { status, headers: corsHeaders }
  );
}
