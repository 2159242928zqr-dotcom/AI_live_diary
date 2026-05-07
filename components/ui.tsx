import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Shell({
  children,
  className,
  contentClassName
}: {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <main className={cn("min-h-screen px-4 py-6 sm:px-6 lg:px-8", className)}>
      <div className={cn("mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-vessel flex-col", contentClassName)}>
        {children}
      </div>
    </main>
  );
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("glass-panel rounded-3xl", className)}>{children}</section>;
}

export function GlowButton({
  className,
  children,
  ...props
}: ComponentProps<"button"> & { children: ReactNode }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl bg-secondary-container px-5 py-3 font-semibold text-secondary shadow-glow transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function GhostLink({
  className,
  children,
  ...props
}: ComponentProps<typeof Link> & { children: ReactNode }) {
  return (
    <Link
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-on-surface-variant transition hover:border-secondary/40 hover:text-secondary",
        className
      )}
      {...props}
    >
      {children}
    </Link>
  );
}

export function Field({
  label,
  children
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-semibold uppercase tracking-[0.05em] text-on-surface-variant">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  "w-full rounded-xl border border-white/5 bg-surface-dim px-4 py-3 text-on-surface shadow-inner outline-none transition placeholder:text-on-surface-variant/45 focus:border-secondary/45 focus:ring-2 focus:ring-secondary/20";
