export const env = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  glmApiKey: process.env.GLM_API_KEY ?? "",
  glmVisionModel: process.env.GLM_VISION_MODEL ?? "glm-4.6v",
  glmTtsVoice: process.env.GLM_TTS_VOICE ?? "xiaochen",
  encryptionKey: process.env.APP_ENCRYPTION_KEY ?? ""
};

export function missingBackendConfig() {
  return [
    ["NEXT_PUBLIC_SUPABASE_URL", env.supabaseUrl],
    ["NEXT_PUBLIC_SUPABASE_ANON_KEY", env.supabaseAnonKey],
    ["SUPABASE_SERVICE_ROLE_KEY", env.supabaseServiceRoleKey],
    ["GLM_API_KEY", env.glmApiKey],
    ["APP_ENCRYPTION_KEY", env.encryptionKey]
  ]
    .filter(([, value]) => !value)
    .map(([key]) => key);
}
