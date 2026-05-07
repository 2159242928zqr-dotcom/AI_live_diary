# Supabase setup

后续配置时按这个顺序操作：

1. 在 Supabase 新建项目。
2. 依次执行 `supabase/migrations` 下的 SQL 迁移。
3. Storage private bucket 会由 `0002_storage_and_policy_hardening.sql` 创建：
   - `diary-images-private`
   - `diary-user-audios-private`
   - `diary-ai-audios-private`
4. 在 Authentication > Providers 启用 Email，并关闭公开注册限制以便 OTP 登录。
5. 把 Project URL、anon key、service role key 填入 `.env.local`。
6. 生成一个至少 32 字符的 `APP_ENCRYPTION_KEY`，也填入 `.env.local`。

注意：`SUPABASE_SERVICE_ROLE_KEY` 和 `GEMINI_API_KEY` 只能放服务端环境变量，不能暴露到前端。
