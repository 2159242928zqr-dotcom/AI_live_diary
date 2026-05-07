import { missingBackendConfig } from "@/lib/env";
import { ok } from "@/lib/api-response";

export async function GET() {
  const missing = missingBackendConfig();
  return ok({
    ok: missing.length === 0,
    mode: missing.length === 0 ? "configured" : "needs_configuration",
    missing
  });
}
