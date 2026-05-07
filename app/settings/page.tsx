"use client";

import { useEffect, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { Check, Copy, Save, Tags } from "lucide-react";
import { GlowButton, inputClass, Panel, Shell } from "@/components/ui";
import { getLocalUser, getTagSettings, saveTagSettings } from "@/lib/local-diary";

export default function SettingsPage() {
  const [inviteCode, setInviteCode] = useState("MV-8Q42A");
  const [copied, setCopied] = useState(false);
  const [eventText, setEventText] = useState("");
  const [moodText, setMoodText] = useState("");
  const [savedTags, setSavedTags] = useState(false);

  useEffect(() => {
    setInviteCode(getLocalUser()?.inviteCode ?? "MV-8Q42A");
    const settings = getTagSettings();
    setEventText(settings.eventTags.join("，"));
    setMoodText(settings.moodTags.join("，"));
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

  function saveTags() {
    const settings = saveTagSettings({
      eventTags: parseTags(eventText),
      moodTags: parseTags(moodText)
    });
    setEventText(settings.eventTags.join("，"));
    setMoodText(settings.moodTags.join("，"));
    setSavedTags(true);
    window.setTimeout(() => setSavedTags(false), 1400);
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
