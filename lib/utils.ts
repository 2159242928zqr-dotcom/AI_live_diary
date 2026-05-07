import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDateLabel(date: string | Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "short"
  }).format(typeof date === "string" ? new Date(date) : date);
}

export function formatTime(date: string | Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(typeof date === "string" ? new Date(date) : date);
}

export function qqEmailIsValid(email: string) {
  return /^[1-9]\d{4,11}@qq\.com$/i.test(email.trim());
}
