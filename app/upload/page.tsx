"use client";

import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ImagePlus, RefreshCcw, Sparkles } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { GhostLink, GlowButton, inputClass, Panel, Shell } from "@/components/ui";
import { authFetch } from "@/lib/api-client";

const maxBytes = 10 * 1024 * 1024;
const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
const maxImageSide = 1400;

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("image failed"));
    image.src = src;
  });
}

async function compressImage(file: File) {
  const dataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(dataUrl);
  const scale = Math.min(1, maxImageSide / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")?.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", 0.82);
}

export default function UploadPage() {
  const router = useRouter();
  const [preview, setPreview] = useState<string>("");
  const [title, setTitle] = useState("");
  const [eventTags, setEventTags] = useState<string[]>([]);
  const [moodTags, setMoodTags] = useState<string[]>([]);
  const [eventTag, setEventTag] = useState("");
  const [moodTag, setMoodTag] = useState("");
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canStart = useMemo(() => Boolean(preview && !error), [preview, error]);

  useEffect(() => {
    authFetch<{ eventTags: string[]; moodTags: string[] }>("/api/auth/profile")
      .then((settings) => {
        setEventTags(settings.eventTags);
        setMoodTags(settings.moodTags);
        setEventTag(settings.eventTags[0] ?? "");
        setMoodTag(settings.moodTags[0] ?? "");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "读取标签失败。"));
  }, []);

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    handleFile(file);
  }

  async function handleFile(file?: File) {
    setError("");
    if (!file) return;
    if (!allowedTypes.includes(file.type)) {
      setError("仅支持 JPG、PNG、WebP 图片。");
      return;
    }
    if (file.size > maxBytes) {
      setError("图片不能超过 10MB。");
      return;
    }
    try {
      setPreview(await compressImage(file));
    } catch {
      setError("图片读取失败，请重新选择。");
    }
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
    handleFile(event.dataTransfer.files?.[0]);
  }

  async function start() {
    if (!canStart) return;
    setIsStarting(true);
    setError("");
    try {
      const draft = await authFetch<{ diary_id: string; status: string }>("/api/diaries", {
        method: "POST",
        body: JSON.stringify({ title, eventTag, moodTag })
      });
      const blob = await (await fetch(preview)).blob();
      const form = new FormData();
      form.append("image", blob, "diary.jpg");
      await authFetch(`/api/diaries/${draft.diary_id}/image`, {
        method: "POST",
        body: form
      });
      window.setTimeout(() => router.push(`/chat/${draft.diary_id}`), 420);
    } catch (err) {
      setIsStarting(false);
      setError(err instanceof Error ? err.message : "创建日记失败。");
    }
  }

  function resetUpload() {
    setPreview("");
    setError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    window.setTimeout(() => fileInputRef.current?.click(), 0);
  }

  return (
    <Shell>
      <AppHeader title="上传图片" />
      <Panel className="grid gap-6 p-6 md:grid-cols-[0.9fr_1.1fr] md:p-8">
        <div className="flex flex-col gap-5">
          <GhostLink className="w-fit" href="/home"><ArrowLeft size={16} />返回</GhostLink>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.05em] text-secondary">创建日记</p>
            <h2 className="mt-2 whitespace-nowrap font-serif text-2xl font-semibold text-primary">从照片开始今天的记录</h2>
            <p className="mt-2 whitespace-nowrap text-xs text-on-surface-variant/70">单篇一张图片 · JPG / PNG / WebP · 最大 10MB</p>
          </div>

          <label className="block space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.05em] text-on-surface-variant">标题</span>
            <input
              className={inputClass}
              maxLength={28}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="例如：海边的下午"
              value={title}
            />
          </label>

          <TagPicker label="事件" onSelect={setEventTag} selected={eventTag} tags={eventTags} />
          <TagPicker label="心情" onSelect={setMoodTag} selected={moodTag} tags={moodTags} />
        </div>

        <div className="space-y-4">
          <label
            className={`flex min-h-[360px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-3xl border border-dashed text-center transition ${
              isDragging
                ? "border-tertiary bg-tertiary/10 shadow-amber"
                : "border-secondary/35 bg-surface-dim/70 hover:border-secondary"
            } ${isStarting ? "scale-[0.98] opacity-70" : ""}`}
            onDragLeave={() => setIsDragging(false)}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDrop={onDrop}
          >
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt="上传图片预览" className="h-full max-h-[430px] w-full object-cover" src={preview} />
            ) : (
              <div className="p-8">
                <ImagePlus className="mx-auto mb-4 text-secondary" size={48} />
                <p className="font-serif text-2xl text-primary">上传一张图片</p>
                <p className="mt-2 text-sm text-on-surface-variant">点击或拖拽到这里</p>
              </div>
            )}
            <input
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={onFileChange}
              ref={fileInputRef}
              type="file"
            />
          </label>

          {error ? <p className="rounded-xl bg-red-950/40 px-4 py-3 text-sm text-red-200">{error}</p> : null}

          <div className="flex flex-wrap gap-3">
            <GlowButton disabled={!canStart || isStarting} onClick={start}>
              <Sparkles size={18} />
              {isStarting ? "正在翻开日记..." : "开始语音日记"}
            </GlowButton>
            <button
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-on-surface-variant transition hover:border-secondary/40 hover:text-secondary"
              onClick={resetUpload}
              type="button"
            >
              <RefreshCcw size={16} />
              重新上传
            </button>
          </div>
        </div>
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
      <p className="text-xs font-semibold uppercase tracking-[0.05em] text-on-surface-variant">{label}</p>
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
