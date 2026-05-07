"use client";

import { ChangeEvent, DragEvent, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ImagePlus, RefreshCcw, Sparkles } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { GhostLink, GlowButton, Panel, Shell } from "@/components/ui";
import { createDraft } from "@/lib/local-diary";

const maxBytes = 10 * 1024 * 1024;
const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

export default function UploadPage() {
  const router = useRouter();
  const [preview, setPreview] = useState<string>("");
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canStart = useMemo(() => Boolean(preview && !error), [preview, error]);

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    handleFile(file);
  }

  function handleFile(file?: File) {
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
    const reader = new FileReader();
    reader.onload = () => setPreview(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => setError("图片读取失败，请重新选择。");
    reader.readAsDataURL(file);
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
    handleFile(event.dataTransfer.files?.[0]);
  }

  function start() {
    if (!canStart) return;
    setIsStarting(true);
    const draft = createDraft(preview);
    window.setTimeout(() => router.push(`/chat/${draft.id}`), 420);
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
        <div className="flex flex-col justify-between gap-8">
          <div>
            <GhostLink href="/home"><ArrowLeft size={16} />返回</GhostLink>
            <h2 className="mt-6 font-serif text-3xl font-semibold text-primary">从一张照片开始今天的记录</h2>
            <p className="mt-3 text-on-surface-variant">第一版每篇日记只支持一张图片。上传成功后，AI 才会开启语音日记。</p>
          </div>
          <p className="text-xs text-on-surface-variant/55">支持 JPG、PNG、WebP，最大 10MB。</p>
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
