"use client";

import { useEffect, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { Check, Copy } from "lucide-react";
import { GlowButton, Panel, Shell } from "@/components/ui";
import { getLocalUser } from "@/lib/local-diary";

export default function SettingsPage() {
  const [inviteCode, setInviteCode] = useState("MV-8Q42A");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setInviteCode(getLocalUser()?.inviteCode ?? "MV-8Q42A");
  }, []);

  async function copyInviteCode() {
    await navigator.clipboard?.writeText(inviteCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
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
            </div>
            <GlowButton className="px-4 py-3" onClick={copyInviteCode}>
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? "已复制" : "复制"}
            </GlowButton>
          </div>
        </Panel>

        <Panel className="p-6 sm:p-8">
          <h2 className="font-serif text-3xl text-primary">项目配置状态</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {["Supabase URL", "Supabase anon key", "Gemini API key", "应用加密密钥"].map((item) => (
            <div className="rounded-2xl border border-white/10 bg-surface-dim/70 p-4" key={item}>
              <p className="text-sm text-on-surface-variant">{item}</p>
              <p className="mt-2 text-tertiary">前端演示模式</p>
            </div>
          ))}
        </div>
        </Panel>
      </div>
    </Shell>
  );
}
