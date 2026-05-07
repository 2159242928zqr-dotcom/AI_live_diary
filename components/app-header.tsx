import { BookOpen, CalendarDays, Home, Settings } from "lucide-react";
import Image from "next/image";
import { GhostLink } from "@/components/ui";

export function AppHeader({ title = "怪咖日记" }: { title?: string }) {
  return (
    <header className="flex items-center justify-between py-4">
      <div className="flex items-center gap-3">
        <Image
          alt="怪咖日记 logo"
          className="size-14 rounded-2xl object-cover shadow-glow"
          height={56}
          src="/weirdo-diary-logo.png"
          width={56}
        />
        <h1 className="font-serif text-2xl font-semibold text-primary sm:text-3xl">{title}</h1>
      </div>
      <nav className="hidden items-center gap-2 sm:flex">
        <GhostLink href="/home"><Home size={16} />首页</GhostLink>
        <GhostLink href="/calendar"><CalendarDays size={16} />日历</GhostLink>
        <GhostLink href="/settings"><Settings size={16} />设置</GhostLink>
      </nav>
      <div className="flex sm:hidden">
        <GhostLink href="/home" aria-label="首页"><BookOpen size={18} /></GhostLink>
      </div>
    </header>
  );
}
