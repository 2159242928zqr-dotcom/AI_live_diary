# 开发日志

记录每次代码修改和架构决策，便于后续开发追溯。

---

## 2026-05-09

### 项目初始化分析
- 分析了整体架构：Next.js + Supabase + GLM AI
- 日记数据存储在 Supabase `diaries` 表，`content_encrypted` 字段存整篇日记 JSON（AES-256-GCM 加密）
- 图片以 base64 data URL 嵌入 DiarySummary 存在数据库中
- 语音存在本地 IndexedDB，跨设备无法播放原始录音

### 同步现状确认
- 文字内容（标题、摘要、正文、标签、消息记录）已实现跨设备同步
- 图片（base64 嵌入内容）→ 数据库，跨设备可见但浪费空间
- 语音（IndexedDB 本地存储）→ 不跨设备，靠浏览器 TTS 回退朗读 transcript
- 草稿、标签设置等仅本地

### 决策：Storage 迁移搁置
- 当前架构对早期阶段够用
- 等有用户验证后再考虑 Supabase Storage 迁移 + 付费体系
- 长线规划：免费额度限制 + 会员版本

---

## 2026-05-30

### 删除 Web 前端，专注移动端 App
- **原因**：不再双平台同步开发，专注 `weirdo-diary-app/` (Expo/React Native)
- **删除内容**：
  - Web 页面：`app/` 下所有 page.tsx（login, home, dashboard, chat, diary, calendar, settings, upload）
  - Web 组件：`components/`（app-header, ui, voice-wave）
  - Web 公共资源：`public/weirdo-diary-logo.png`
  - Web 前端库：`lib/local-diary.ts`, `lib/diary-sync.ts`, `lib/local-audio.ts`, `lib/utils.ts`
  - Root layout + CSS：`app/layout.tsx`, `app/globals.css`
- **保留的 API 后端**：`app/api/` 所有路由 + `lib/` 下 AI/认证/CORS/加密 模块，作为移动端轻量代理
- **移动端架构**：`weirdo-diary-app/` 自包含 Expo 项目，`lib/api.ts` 支持两种模式：
  1. 默认模式：通过 Next.js API 代理请求（保留的后端）
  2. 本地直连模式：`useLocalAi: true` 时直接调用智谱 GLM API（可在设置页切换）

---

## 2026-05-31

### 移动端 UI/UX 优化与身份验证增强
- **手账风自定义弹窗**：在移动端（`weirdo-diary-app`）引入统一的复古手写风格 Alert 和 Confirm 提示框替代系统默认样式，与整体手账美学风格融合。
- **完善身份验证体系**：
  - 支持“验证码免密登录”与“账号密码登录”的双模登录流。
  - 新增邮箱验证与激活流程、验证码冷却倒计时，防止频繁触发。
  - 新增 OTP 密码重置弹窗，修复重置状态及文本框光标/聚焦问题。
- **账号设置优化与信息留存**：
  - 在登录流程中优化属性优先级，**优先使用本地缓存的个性化昵称和头像**，防止服务器端的旧数据覆盖本地个性化更改。
  - 改进账号切换，跳过繁杂的注销重定向，避免页面抖动。
- **本地数据无损迁移 (三路安全合并)**：在 `storage.ts` 中实现 `mergeAndMigrateAllLocalDiaries`，对旧版单一文件 (`diary-data.json`)、未登录临时文件 (`diary-data-shared.json`) 和专属账号库文件进行三路安全合并，清空旧备份防数据重复复活，确保版本升级后日记 100% 不丢失。
- **布局优化**：修复手账标签横向溢出导致滚动时部分区域被裁剪的问题。
- **云端数据同步**：实现了基于 Supabase 的个人配置与日记数据云端实时同步功能。

### 后端服务扩展
- **新增邀请路由**：添加 `app/api/auth/invitation/route.ts` 接口，支持用户绑定专属邀请码、查询邀请人邮箱以及获取已邀请用户列表，作为用户邀请和活动分析的基础。

### 代码提交与基础设施调试
- **Git 网络与 SSL 优化**：针对 Windows 环境下推送 GitHub 的 schannel TLS 握手失败问题，将 Git 的 SSL 后端切换为 OpenSSL，并全局配置本地 SOCKS5 代理。
- **推送 GitHub**：成功提交所有开发成果，并将本地 `main` 分支推送至 GitHub 远程仓库。

