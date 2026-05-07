"use client";

import { useEffect, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { Check, Copy, Eye, EyeOff, Lock, Save, Tags } from "lucide-react";
import { GlowButton, inputClass, Panel, Shell } from "@/components/ui";
import { authFetch } from "@/lib/api-client";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function SettingsPage() {
  const [inviteCode, setInviteCode] = useState("MV-8Q42A");
  const [email, setEmail] = useState("");
  const [copied, setCopied] = useState(false);
  const [eventText, setEventText] = useState("");
  const [moodText, setMoodText] = useState("");
  const [savedTags, setSavedTags] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [message, setMessage] = useState("");
  const passwordMismatch = Boolean(confirmPassword && newPassword !== confirmPassword);

  useEffect(() => {
    authFetch<{ email: string; inviteCode: string; eventTags: string[]; moodTags: string[] }>("/api/auth/profile")
      .then((settings) => {
        setEmail(settings.email);
        setInviteCode(settings.inviteCode);
        setEventText(settings.eventTags.join("，"));
        setMoodText(settings.moodTags.join("，"));
      })
      .catch((err) => setMessage(err instanceof Error ? err.message : "读取设置失败。"));
  }, []);

  async function copyInviteCode() {
    await navigator.clipboard?.writeText(inviteCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  function parseTags(value: string) {
    return Array.from(
      new Set(
        value
          .split(/[,，、\n]/)
          .map((tag) => tag.trim())
          .filter(Boolean)
      )
    );
  }

  async function saveTags() {
    try {
      const settings = await authFetch<{ eventTags: string[]; moodTags: string[] }>("/api/auth/profile", {
        method: "PATCH",
        body: JSON.stringify({
          eventTags: parseTags(eventText),
          moodTags: parseTags(moodText)
        })
      });
      setEventText(settings.eventTags.join("，"));
      setMoodText(settings.moodTags.join("，"));
      setSavedTags(true);
      setMessage("");
      window.setTimeout(() => setSavedTags(false), 1400);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "保存标签失败。");
    }
  }

  async function savePassword() {
    if (!email) {
      setMessage("还没有读取到账户邮箱，请稍后再试。");
      return;
    }
    if (newPassword.length < 8) {
      setMessage("新密码至少需要 8 位。");
      return;
    }
    if (!currentPassword) {
      setMessage("请输入当前密码。");
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage("两次输入的新密码不一致。");
      return;
    }
    const supabase = getSupabaseBrowserClient();
    const verify = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword
    });
    if (verify.error) {
      setMessage("当前密码不正确。");
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setMessage(error.message.includes("rate") ? "操作太频繁了，请稍后再试。" : error.message);
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordSaved(true);
    setMessage("");
    window.setTimeout(() => setPasswordSaved(false), 1400);
  }

  return (
    <Shell>
      <AppHeader title="设置" />
      <div className="space-y-5">
        <Panel className="p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm text-on-surface-variant">我的邀请码</p>
              <p className="mt-1 font-serif text-3xl text-secondary">{inviteCode}</p>
              {email ? <p className="mt-2 text-sm text-on-surface-variant">{email}</p> : null}
            </div>
            <GlowButton className="px-4 py-3" onClick={copyInviteCode}>
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? "已复制" : "复制"}
            </GlowButton>
          </div>
        </Panel>
        {message ? <p className="rounded-2xl bg-surface-dim px-4 py-3 text-sm text-on-surface-variant">{message}</p> : null}

        <Panel className="p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm text-on-surface-variant">日记标签</p>
              <h2 className="mt-1 font-serif text-3xl text-primary">上传页选项</h2>
            </div>
            <GlowButton className="px-4 py-3" onClick={saveTags}>
              {savedTags ? <Check size={16} /> : <Save size={16} />}
              {savedTags ? "已保存" : "保存标签"}
            </GlowButton>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="block space-y-2">
              <span className="inline-flex items-center gap-2 text-sm text-on-surface-variant">
                <Tags size={15} />
                事件
              </span>
              <input
                className={inputClass}
                onChange={(event) => setEventText(event.target.value)}
                placeholder="旅游，看电影，聚会"
                value={eventText}
              />
            </label>
            <label className="block space-y-2">
              <span className="inline-flex items-center gap-2 text-sm text-on-surface-variant">
                <Tags size={15} />
                心情
              </span>
              <input
                className={inputClass}
                onChange={(event) => setMoodText(event.target.value)}
                placeholder="开心，高兴，平静"
                value={moodText}
              />
            </label>
          </div>
        </Panel>

        <Panel className="p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm text-on-surface-variant">账户安全</p>
              <h2 className="mt-1 font-serif text-3xl text-primary">修改密码</h2>
            </div>
            <GlowButton className="px-4 py-3" onClick={savePassword}>
              {passwordSaved ? <Check size={16} /> : <Lock size={16} />}
              {passwordSaved ? "已修改" : "保存新密码"}
            </GlowButton>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <PasswordInput label="当前密码" onChange={setCurrentPassword} placeholder="输入当前密码" value={currentPassword} />
            <PasswordInput label="新密码" onChange={setNewPassword} placeholder="至少 8 位" value={newPassword} />
            <PasswordInput label="确认新密码" onChange={setConfirmPassword} placeholder="再次输入新密码" value={confirmPassword} />
          </div>
          {passwordMismatch ? <p className="mt-4 rounded-xl bg-red-950/40 px-4 py-3 text-sm text-red-200">两次输入的新密码不一致。</p> : null}
        </Panel>

        <Panel className="p-6 sm:p-8">
          <h2 className="font-serif text-3xl text-primary">项目配置状态</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {["Supabase URL", "Supabase anon key", "Gemini API key", "应用加密密钥"].map((item) => (
            <div className="rounded-2xl border border-white/10 bg-surface-dim/70 p-4" key={item}>
              <p className="text-sm text-on-surface-variant">{item}</p>
              <p className="mt-2 text-tertiary">后端配置读取中</p>
            </div>
          ))}
        </div>
        </Panel>
      </div>
    </Shell>
  );
}

function PasswordInput({
  label,
  onChange,
  placeholder,
  value
}: {
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="block space-y-2">
      <span className="inline-flex items-center gap-2 text-sm text-on-surface-variant">
        <Lock size={15} />
        {label}
      </span>
      <div className="relative">
        <Lock className="pointer-events-none absolute left-4 top-3.5 text-on-surface-variant" size={18} />
        <input
          className={`${inputClass} pl-14 pr-12`}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          type={visible ? "text" : "password"}
          value={value}
        />
        <button
          aria-label={visible ? "隐藏密码" : "显示密码"}
          className="absolute right-3 top-3.5 text-on-surface-variant transition hover:text-secondary"
          onClick={() => setVisible((current) => !current)}
          type="button"
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </label>
  );
}
