"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { Panel, Shell } from "@/components/ui";
import { demoDate, demoDiary } from "@/lib/demo-data";
import { listDiaries } from "@/lib/local-diary";
import type { DiarySummary } from "@/lib/types";

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getCalendarCells(cursor: Date) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const firstWeekday = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  return Array.from({ length: 42 }, (_, index) => {
    const day = index - firstWeekday + 1;
    return day >= 1 && day <= daysInMonth ? day : null;
  });
}

export default function CalendarPage() {
  const [cursor, setCursor] = useState(() => new Date(2026, 4, 1));
  const [today, setToday] = useState(demoDate);
  const [diaries, setDiaries] = useState<DiarySummary[]>([demoDiary]);
  const [selectedDate, setSelectedDate] = useState(demoDate);
  const cells = useMemo(() => getCalendarCells(cursor), [cursor]);
  const currentMonth = monthKey(cursor);

  const diariesByDate = useMemo(() => {
    return diaries.reduce<Record<string, DiarySummary[]>>((acc, diary) => {
      acc[diary.date] = [...(acc[diary.date] ?? []), diary];
      return acc;
    }, {});
  }, [diaries]);
  const selectedDiaries = diariesByDate[selectedDate] ?? [];

  function changeMonth(offset: number) {
    setCursor((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  }

  useEffect(() => {
    const now = new Date();
    const nextToday = now.toISOString().slice(0, 10);
    setToday(nextToday);
    setCursor(new Date(now.getFullYear(), now.getMonth(), 1));
    const saved = listDiaries();
    setDiaries(saved);
    setSelectedDate(saved[0]?.date ?? nextToday);
  }, []);

  return (
    <Shell>
      <AppHeader title="记忆日历" />
      <Panel className="grid gap-6 p-5 md:grid-cols-[1fr_320px] md:p-8">
        <section>
          <div className="mb-6 flex items-center justify-between">
            <button
              aria-label="上个月"
              className="inline-flex items-center justify-center rounded-xl border border-white/10 px-4 py-2 text-sm text-on-surface-variant transition hover:border-secondary/40 hover:text-secondary"
              onClick={() => changeMonth(-1)}
              type="button"
            >
              <ChevronLeft size={16} />
            </button>
            <h2 className="font-serif text-2xl text-primary">{cursor.getFullYear()} 年 {cursor.getMonth() + 1} 月</h2>
            <button
              aria-label="下个月"
              className="inline-flex items-center justify-center rounded-xl border border-white/10 px-4 py-2 text-sm text-on-surface-variant transition hover:border-secondary/40 hover:text-secondary"
              onClick={() => changeMonth(1)}
              type="button"
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-2 text-center text-xs text-on-surface-variant">
            {["一", "二", "三", "四", "五", "六", "日"].map((day) => <div className="py-2" key={day}>{day}</div>)}
            {cells.map((day, index) => {
              if (!day) return <div className="min-h-20 rounded-2xl border border-white/5 bg-black/10" key={`blank-${index}`} />;
              const date = `${currentMonth}-${String(day).padStart(2, "0")}`;
              const dayDiaries = diariesByDate[date] ?? [];
              const hasDiary = dayDiaries.length > 0;
              const isToday = date === today;
              const isSelected = date === selectedDate;
              return (
                <button
                  className={`relative min-h-20 rounded-2xl border p-2 text-left transition ${
                    isSelected
                      ? "border-tertiary/60 bg-tertiary/10 shadow-amber"
                      : hasDiary
                        ? "border-secondary/35 bg-secondary-container/15"
                        : "border-white/5 bg-surface-dim/50 hover:border-secondary/30"
                  }`}
                  key={date}
                  onClick={() => setSelectedDate(date)}
                  type="button"
                >
                  <span className={isToday ? "text-tertiary" : "text-on-surface-variant"}>{day}</span>
                  {hasDiary ? (
                    <span className="absolute bottom-3 left-3 flex items-center gap-1">
                      <span className="size-2 rounded-full bg-tertiary shadow-amber" />
                      <span>{dayDiaries.length}</span>
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </section>

        <aside className="rounded-3xl border border-white/10 bg-surface-dim/60 p-5">
          <p className="text-sm text-on-surface-variant">{selectedDate}</p>
          <h3 className="mt-1 font-serif text-2xl text-primary">{selectedDiaries.length} 篇日记</h3>
          <div className="mt-5 space-y-4">
            {selectedDiaries.length > 0 ? selectedDiaries.map((diary) => (
              <Link
                className="block rounded-2xl border border-white/10 bg-surface-container p-4 transition hover:border-secondary/35"
                href={`/diaries/${diary.id}`}
                key={diary.id}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt="日记封面" className="mb-4 h-32 w-full rounded-xl object-cover" src={diary.imageUrl || demoDiary.imageUrl} />
                <TagRow eventTag={diary.eventTag} moodTag={diary.moodTag} />
                <h4 className="font-serif text-lg text-on-surface">{diary.title}</h4>
                <p className="mt-2 line-clamp-3 text-sm text-on-surface-variant">{diary.summary}</p>
              </Link>
            )) : (
              <div className="rounded-2xl border border-white/10 bg-surface-container p-4 text-sm text-on-surface-variant">
                这一天还没有日记。
              </div>
            )}
          </div>
        </aside>
      </Panel>
    </Shell>
  );
}

function TagRow({ eventTag, moodTag }: { eventTag?: string; moodTag?: string }) {
  const tags = [eventTag, moodTag].filter(Boolean);
  if (tags.length === 0) return null;
  return (
    <div className="mb-3 flex flex-wrap gap-2">
      {tags.map((tag) => (
        <span className="rounded-full border border-tertiary/35 bg-tertiary/10 px-2.5 py-1 text-xs text-tertiary" key={tag}>
          {tag}
        </span>
      ))}
    </div>
  );
}
