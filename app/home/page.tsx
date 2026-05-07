"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { Panel, Shell } from "@/components/ui";
import { authFetch } from "@/lib/api-client";
import type { DiarySummary } from "@/lib/types";

export default function HomePage() {
  const [recentDiaries, setRecentDiaries] = useState<DiarySummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    authFetch<{ items: DiarySummary[] }>("/api/diaries?limit=3")
      .then((data) => {
        setRecentDiaries(data.items.slice(0, 3));
        setMessage("");
      })
      .catch((err) => setMessage(err instanceof Error ? err.message : "读取最近日记失败。"))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <Shell>
      <AppHeader title="怪咖日记" />
      <div className="grid flex-1 gap-5 lg:grid-cols-[1fr_280px]">
        <Panel className="book-cover flex flex-col justify-center overflow-hidden p-8 sm:p-12">
          <h2 className="max-w-3xl font-serif text-4xl font-bold leading-[1.12] text-primary sm:text-5xl">
            <span className="block">把一张照片</span>
            <span className="mt-3 block pl-0 text-secondary sm:whitespace-nowrap sm:pl-12">慢慢说成一篇日记</span>
          </h2>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-on-surface-variant">
            上传照片后，AI 会先用语音开启对话。你可以说，也可以写，最后把这些片段整理成只属于你的日记。
          </p>
          {message ? <p className="mt-5 rounded-2xl bg-surface-dim px-4 py-3 text-sm text-on-surface-variant">{message}</p> : null}
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link
              className="group relative inline-flex items-center gap-4 overflow-hidden rounded-2xl border border-secondary/35 bg-gradient-to-r from-secondary-container via-violet to-tertiary px-7 py-4 font-semibold text-slate-950 shadow-glow transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_0_48px_rgba(206,189,255,0.42)]"
              href="/upload"
            >
              <span className="absolute inset-0 bg-white/20 opacity-0 transition group-hover:opacity-100" />
              <span className="relative flex size-10 items-center justify-center rounded-full bg-black/15">
                <Sparkles size={20} />
              </span>
              <span className="relative text-base">开启今日日记</span>
              <ArrowRight className="relative transition group-hover:translate-x-1" size={18} />
            </Link>
          </div>
        </Panel>

        <aside className="space-y-5">
          <Panel className="p-5">
            <p className="text-sm text-on-surface-variant">最近日记</p>
            {isLoading ? (
              <div className="mt-3 space-y-3">
                {[0, 1, 2].map((item) => (
                  <div className="rounded-2xl border border-white/10 bg-surface-dim p-3" key={item}>
                    <div className="h-24 rounded-xl bg-surface-container" />
                    <div className="mt-3 h-5 rounded-full bg-surface-container" />
                    <div className="mt-2 h-4 w-2/3 rounded-full bg-surface-container" />
                  </div>
                ))}
              </div>
            ) : recentDiaries.length > 0 ? (
              <div className="mt-3 space-y-3">
                {recentDiaries.map((diary) => (
                  <Link className="block rounded-2xl border border-white/10 bg-surface-dim p-3 transition hover:border-secondary/35" href={`/diaries/${diary.id}`} key={diary.id}>
                    {diary.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img alt="最近日记封面" className="h-24 w-full rounded-xl object-cover" src={diary.imageUrl} />
                    ) : (
                      <div className="flex h-24 w-full items-center justify-center rounded-xl bg-surface-container text-xs text-on-surface-variant">没有图片</div>
                    )}
                    <h3 className="mt-3 line-clamp-2 font-serif text-lg leading-snug text-primary">{diary.title}</h3>
                    <p className="mt-1 line-clamp-2 text-sm text-on-surface-variant">{diary.summary}</p>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="mt-3 rounded-2xl border border-white/10 bg-surface-dim p-4 text-sm text-on-surface-variant">还没有日记。</p>
            )}
          </Panel>
        </aside>
      </div>
    </Shell>
  );
}
