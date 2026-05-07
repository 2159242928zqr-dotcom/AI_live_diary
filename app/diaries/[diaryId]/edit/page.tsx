"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Save, Wand2 } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { GhostLink, GlowButton, inputClass, Panel, Shell } from "@/components/ui";
import { authFetch } from "@/lib/api-client";
import { demoDiary } from "@/lib/demo-data";
import type { DiaryMessage, DiarySummary } from "@/lib/types";

export default function EditDiaryPage() {
  const router = useRouter();
  const params = useParams<{ diaryId: string }>();
  const [title, setTitle] = useState(demoDiary.title);
  const [summary, setSummary] = useState(demoDiary.summary);
  const [content, setContent] = useState(demoDiary.content);
  const [eventTags, setEventTags] = useState<string[]>([]);
  const [moodTags, setMoodTags] = useState<string[]>([]);
  const [eventTag, setEventTag] = useState("");
  const [moodTag, setMoodTag] = useState("");
  const [message, setMessage] = useState("");
  const [diaryMessages, setDiaryMessages] = useState<DiaryMessage[]>([]);

  useEffect(() => {
    Promise.all([
      authFetch<DiarySummary>(`/api/diaries/${params.diaryId}`),
      authFetch<{ eventTags: string[]; moodTags: string[] }>("/api/auth/profile")
    ])
      .then(([diary, settings]) => {
        setTitle(diary.title);
        setSummary(diary.summary);
        setContent(diary.content);
        setDiaryMessages(diary.messages);
        setEventTags(settings.eventTags);
        setMoodTags(settings.moodTags);
        setEventTag(diary.eventTag || settings.eventTags[0] || "");
        setMoodTag(diary.moodTag || settings.moodTags[0] || "");
      })
      .catch((err) => setMessage(err instanceof Error ? err.message : "读取日记失败。"));
  }, [params.diaryId]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim() || !summary.trim() || !content.trim()) {
      setMessage("标题、摘要和正文都需要填写。");
      return;
    }
    try {
      await authFetch(`/api/diaries/${params.diaryId}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: title.trim(),
          summary: summary.trim(),
          content: content.trim(),
          eventTag,
          moodTag
        })
      });
      router.push(`/diaries/${params.diaryId}`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "保存失败。");
    }
  }

  function regenerate() {
    const source = diaryMessages
      .filter((item) => item.role === "user")
      .map((item) => item.text || item.transcript)
      .filter(Boolean)
      .join(" ");
    setTitle("重新整理后的怪咖记忆");
    setSummary(source || "一次围绕照片展开的语音日记，记录当下看见的画面和心里的感受。");
    setContent(
      source
        ? `今天我重新整理了这段日记。${source} 回看这些话时，我更能看见当时真正牵动我的东西，也愿意把它安静地放进今天。`
        : demoDiary.content
    );
    setMessage("已根据聊天记录重新生成一版，可继续编辑后保存。");
  }

  return (
    <Shell>
      <AppHeader title="编辑日记" />
      <Panel className="p-6 sm:p-8">
        <form className="space-y-5" onSubmit={submit}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-secondary">标题、标签和 AI 生成内容可编辑</p>
              <h2 className="font-serif text-3xl text-primary">整理这篇日记</h2>
            </div>
            <GhostLink href={`/diaries/${params.diaryId}`}>取消</GhostLink>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <TagPicker label="事件" onSelect={setEventTag} selected={eventTag} tags={eventTags} />
            <TagPicker label="心情" onSelect={setMoodTag} selected={moodTag} tags={moodTags} />
          </div>
          <label className="block space-y-2">
            <span className="text-sm text-on-surface-variant">标题</span>
            <input className={inputClass} onChange={(event) => setTitle(event.target.value)} value={title} />
          </label>
          <label className="block space-y-2">
            <span className="text-sm text-on-surface-variant">摘要</span>
            <textarea className={`${inputClass} min-h-24`} onChange={(event) => setSummary(event.target.value)} value={summary} />
          </label>
          <label className="block space-y-2">
            <span className="text-sm text-on-surface-variant">正文</span>
            <textarea className={`${inputClass} min-h-72 leading-7`} onChange={(event) => setContent(event.target.value)} value={content} />
          </label>
          {message ? <p className="rounded-xl bg-surface-dim px-4 py-3 text-sm text-on-surface-variant">{message}</p> : null}
          <div className="flex flex-wrap gap-3">
            <GlowButton type="submit"><Save size={18} />保存</GlowButton>
            <button
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-on-surface-variant"
              onClick={regenerate}
              type="button"
            >
              <Wand2 size={16} />
              重新生成
            </button>
          </div>
        </form>
      </Panel>
    </Shell>
  );
}

function TagPicker({
  label,
  onSelect,
  selected,
  tags
}: {
  label: string;
  onSelect: (tag: string) => void;
  selected: string;
  tags: string[];
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-on-surface-variant">{label}</p>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <button
            className={`rounded-full border px-3 py-1.5 text-sm transition ${
              selected === tag
                ? "border-tertiary/55 bg-tertiary/15 text-tertiary shadow-amber"
                : "border-white/10 bg-surface-dim/50 text-on-surface-variant hover:border-secondary/40 hover:text-secondary"
            }`}
            key={tag}
            onClick={() => onSelect(tag)}
            type="button"
          >
            {tag}
          </button>
        ))}
      </div>
    </div>
  );
}
