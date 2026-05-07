import { cn } from "@/lib/utils";

export function VoiceWave({ active = false, className }: { active?: boolean; className?: string }) {
  return (
    <div className={cn("flex h-9 items-center gap-1.5", className)} aria-hidden>
      {Array.from({ length: 18 }).map((_, index) => (
        <span
          className={cn(
            "voice-bar block w-1.5 rounded-full bg-gradient-to-t from-secondary-container to-secondary",
            !active && "animate-none opacity-65"
          )}
          key={index}
          style={{ height: `${12 + ((index * 7) % 24)}px` }}
        />
      ))}
    </div>
  );
}
