"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Edit3, Eye, EyeOff, Play, Trash2 } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { GhostLink, GlowButton, Panel, Shell } from "@/components/ui";
import { VoiceWave } from "@/components/voice-wave";
import { demoDiary } from "@/lib/demo-data";
import { deleteDiary, loadSavedDiary } from "@/lib/local-diary";
import type { DiarySummary } from "@/lib/types";
import { formatDateLabel } from "@/lib/utils";

export default function DiaryDetailPage() {
  const router = useRouter();
  const params = useParams<{ diaryId: string }>();
  const [showTranscript, setShowTranscript] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [diary, setDiary] = useState<DiarySummary>(demoDiary);

  useEffect(() => {
    setDiary(loadSavedDiary(params.diaryId));
  }, [params.diaryId]);

  function confirmDelete() {
    deleteDiary(diary.id);
    router.push("/calendar");
  }

  function playTranscript(text?: string) {
    if (!text || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN";
    window.speechSynthesis.speak(utterance);
  }

  return (
    <Shell>
      <AppHeader title="日记详情" />
      <Panel className="overflow-hidden">
        <div className="grid gap-0 lg:grid-cols-[330px_1fr]">
          <aside className="border-b border-white/10 p-5 lg:border-b-0 lg:border-r">
            <GhostLink href="/calendar"><ArrowLeft size={16} />返回日历</GhostLink>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt="日记图片" className="mt-5 aspect-[4/5] w-full rounded-3xl object-cover" src={diary.imageUrl || ""} />
          </aside>
          <article className="p-5 sm:p-8">
            <p className="text-sm text-tertiary">{formatDateLabel(diary.createdAt)}</p>
            <h2 className="mt-2 font-serif text-4xl font-bold text-primary">{diary.title}</h2>
            <p className="mt-4 rounded-2xl border border-white/10 bg-surface-dim/70 p-4 text-on-surface-variant">{diary.summary}</p>
            <div className="prose prose-invert mt-6 max-w-none text-on-surface">
              <p>{diary.content}</p>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <GlowButton onClick={() => setShowTranscript((value) => !value)}>
                {showTranscript ? <EyeOff size={18} /> : <Eye size={18} />}
                {showTranscript ? "隐藏转文本" : "显示转文本"}
              </GlowButton>
              <GhostLink href={`/diaries/${diary.id}/edit`}><Edit3 size={16} />编辑总结</GhostLink>
              <button
                className="inline-flex items-center gap-2 rounded-xl border border-red-300/20 px-4 py-2 text-sm text-red-200 transition hover:bg-red-500/10"
                onClick={() => setConfirming(true)}
              >
                <Trash2 size={16} />
                删除日记
              </button>
            </div>

            <section className="mt-8 space-y-4">
              <h3 className="font-serif text-2xl text-primary">原始聊天记录</h3>
              {diary.messages.map((message) => (
                <div className="rounded-2xl border border-white/10 bg-surface-dim/70 p-4" key={message.id}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm text-on-surface-variant">{message.role === "assistant" ? "AI 语音" : message.inputType === "text" ? "用户文字" : "用户语音"}</p>
                      {message.inputType === "text" ? <p className="mt-2 text-on-surface">{message.text}</p> : <VoiceWave />}
                    </div>
                    {message.inputType !== "text" ? (
                      <button
                        aria-label="播放语音"
                        className="inline-flex size-11 items-center justify-center rounded-full bg-secondary-container/60 text-secondary"
                        onClick={() => playTranscript(message.transcript)}
                        type="button"
                      >
                        <Play size={18} />
                      </button>
                    ) : null}
                  </div>
                  {showTranscript && message.transcript ? (
                    <p className="mt-3 rounded-xl bg-surface-container px-4 py-3 text-sm text-on-surface-variant">{message.transcript}</p>
                  ) : null}
                </div>
              ))}
            </section>
          </article>
        </div>
      </Panel>

      {confirming ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur">
          <Panel className="max-w-md p-6 text-center">
            <Trash2 className="mx-auto mb-4 text-red-200" size={42} />
            <h2 className="font-serif text-2xl text-primary">确定要删除这段记忆吗？</h2>
            <p className="mt-3 text-sm text-on-surface-variant">
              删除后，该日记的图片、用户语音、AI 语音、聊天记录、语音转文本和 AI 总结都会被删除，无法恢复。确认删除吗？
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <button className="rounded-xl border border-white/10 px-4 py-2 text-on-surface-variant" onClick={() => setConfirming(false)}>取消</button>
              <button className="rounded-xl bg-red-500/20 px-4 py-2 text-red-100" onClick={confirmDelete}>确认删除</button>
            </div>
          </Panel>
        </div>
      ) : null}
    </Shell>
  );
}
