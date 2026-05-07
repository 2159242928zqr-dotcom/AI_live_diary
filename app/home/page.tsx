"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { Panel, Shell } from "@/components/ui";
import { demoDiary } from "@/lib/demo-data";
import { listDiaries } from "@/lib/local-diary";
import type { DiarySummary } from "@/lib/types";

export default function HomePage() {
  const [recentDiary, setRecentDiary] = useState<DiarySummary | null>(null);

  useEffect(() => {
    setRecentDiary(listDiaries()[0] ?? null);
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
            {recentDiary ? (
              <Link className="mt-3 block rounded-2xl border border-white/10 bg-surface-dim p-3 transition hover:border-secondary/35" href={`/diaries/${recentDiary.id}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt="最近日记封面" className="h-28 w-full rounded-xl object-cover" src={recentDiary.imageUrl || demoDiary.imageUrl} />
                <h3 className="mt-3 font-serif text-lg text-primary">{recentDiary.title}</h3>
                <p className="mt-1 line-clamp-2 text-sm text-on-surface-variant">{recentDiary.summary}</p>
              </Link>
            ) : (
              <p className="mt-3 rounded-2xl border border-white/10 bg-surface-dim p-4 text-sm text-on-surface-variant">还没有日记。</p>
            )}
          </Panel>
        </aside>
      </div>
    </Shell>
  );
}
