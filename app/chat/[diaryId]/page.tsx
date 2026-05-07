"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Mic, Send, Square, Timer } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { GhostLink, GlowButton, inputClass, Panel, Shell } from "@/components/ui";
import { VoiceWave } from "@/components/voice-wave";
import { authFetch } from "@/lib/api-client";
import type { DiaryMessage } from "@/lib/types";

const maxSeconds = 10 * 60;
const makeTempId = () => `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export default function ChatPage() {
  const router = useRouter();
  const params = useParams<{ diaryId: string }>();
  const [messages, setMessages] = useState<DiaryMessage[]>([]);
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [diaryImage, setDiaryImage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [secondsLeft, setSecondsLeft] = useState(maxSeconds);
  const [notice, setNotice] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const locked = recording || aiSpeaking;
  const remaining = useMemo(() => {
    const minutes = Math.floor(secondsLeft / 60).toString().padStart(2, "0");
    const seconds = (secondsLeft % 60).toString().padStart(2, "0");
    return `${minutes}:${seconds}`;
  }, [secondsLeft]);

  useEffect(() => {
    setIsLoading(true);
    authFetch<{ image_url: string; messages: DiaryMessage[]; status: string }>(`/api/diaries/${params.diaryId}/start`, {
      method: "POST"
    })
      .then((data) => {
        setDiaryImage(data.image_url || "");
        setMessages(data.messages);
      })
      .catch((err) => setNotice(err instanceof Error ? err.message : "载入日记失败，请返回重新上传。"))
      .finally(() => setIsLoading(false));
  }, [params.diaryId]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          setNotice("本次语音日记已到 10 分钟，可以生成日记。");
          return 0;
        }
        if (current === 120) setNotice("本次语音日记还有 2 分钟。");
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  async function sendText(event: FormEvent) {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || locked || secondsLeft === 0) return;
    const tempId = makeTempId();
    const optimisticMessage: DiaryMessage = {
      id: tempId,
      role: "user",
      inputType: "text",
      text: trimmed,
      createdAt: new Date().toISOString()
    };

    setMessages((current) => [...current, optimisticMessage]);
    setAiSpeaking(true);
    setText("");
    try {
      const data = await authFetch<{ messages: DiaryMessage[] }>(`/api/diaries/${params.diaryId}/messages/text`, {
        method: "POST",
        body: JSON.stringify({ content: trimmed })
      });
      setMessages((current) => current.flatMap((message) => (message.id === tempId ? data.messages : [message])));
    } catch (err) {
      setMessages((current) => current.filter((message) => message.id !== tempId));
      setNotice(err instanceof Error ? err.message : "发送失败。");
      setText(trimmed);
    } finally {
      setAiSpeaking(false);
    }
  }

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setNotice("当前浏览器不支持录音，可以先用文字输入。");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        setRecording(false);
        setNotice("语音持久化和转写将在下一阶段接入，这一版请先用文字保存到数据库。");
      };
      recorder.start();
      setRecording(true);
      setNotice("正在录音，再点一次结束本轮回答。");
    } catch {
      setNotice("无法访问麦克风。请允许浏览器录音权限，或先用文字输入。");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
  }

  function toggleRecording() {
    if (aiSpeaking || secondsLeft === 0) return;
    if (recording) {
      stopRecording();
      return;
    }
    void startRecording();
  }

  async function generateDiary() {
    try {
      const diary = await authFetch<{ diary_id: string; status: string }>(`/api/diaries/${params.diaryId}/generate`, {
        method: "POST"
      });
      router.push(`/diaries/${diary.diary_id}`);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "生成日记失败。");
    }
  }

  return (
    <Shell>
      <AppHeader title="语音日记" />
      <Panel className="flex min-h-[calc(100vh-8rem)] flex-col overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-4">
          <GhostLink href="/upload"><ArrowLeft size={16} />返回</GhostLink>
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-surface-dim px-4 py-2 text-sm text-on-surface-variant">
            <Timer size={16} />
            剩余 {remaining}
          </div>
        </div>

        <div className="grid flex-1 gap-0 lg:grid-cols-[280px_1fr]">
          <aside className="border-b border-white/10 p-4 lg:border-b-0 lg:border-r">
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-surface-dim">
              {diaryImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt="日记图片缩略图" className="h-52 w-full object-cover" src={diaryImage} />
              ) : (
                <div className="flex h-52 w-full items-center justify-center text-sm text-on-surface-variant">
                  {isLoading ? "正在载入图片..." : "没有图片"}
                </div>
              )}
            </div>
            {notice ? <p className="mt-4 rounded-2xl bg-surface-dim px-4 py-3 text-sm text-on-surface-variant">{notice}</p> : null}
          </aside>

          <section className="flex min-h-[520px] flex-col">
            <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
              {isLoading ? <p className="text-sm text-on-surface-variant">正在载入对话...</p> : null}
              {messages.map((message) => (
                <div className={message.role === "user" ? "flex justify-end" : "flex justify-start"} key={message.id}>
                  <div className={`max-w-[82%] rounded-2xl border p-4 ${
                    message.role === "user"
                      ? "border-tertiary/20 bg-tertiary/10 text-on-surface"
                      : "border-secondary/25 bg-secondary-container/20 text-secondary"
                  }`}>
                    {message.inputType === "text" ? (
                      <p>{message.text}</p>
                    ) : (
                      <div className="flex items-center gap-3">
                        <VoiceWave active={message.role === "assistant"} />
                        <span className="text-sm">{message.role === "assistant" ? "AI 语音" : "用户语音"}</span>
                        {message.audioUrl && message.role === "user" ? (
                          <audio className="h-9 max-w-36" controls src={message.audioUrl} />
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {aiSpeaking ? (
                <div className="flex justify-start">
                  <div className="rounded-2xl border border-secondary/25 bg-secondary-container/20 p-4 text-secondary">
                    <VoiceWave active />
                    <p className="mt-2 text-sm">AI 正在说话...</p>
                  </div>
                </div>
              ) : null}
            </div>

            <form className="border-t border-white/10 p-4" onSubmit={sendText}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <button
                  aria-label={recording ? "停止录音" : "开始录音"}
                  className={`inline-flex size-14 items-center justify-center rounded-full border transition ${
                    recording
                      ? "border-red-300 bg-red-500/20 text-red-100"
                      : "border-secondary/35 bg-secondary-container/40 text-secondary"
                  }`}
                  disabled={aiSpeaking || secondsLeft === 0}
                  onClick={toggleRecording}
                  type="button"
                >
                  {recording ? <Square size={22} /> : <Mic size={22} />}
                </button>
                <GlowButton type="button" onClick={generateDiary}>
                  结束通话 / 生成日记
                </GlowButton>
              </div>
              <div className="flex gap-3">
                <input
                  className={inputClass}
                  disabled={locked || secondsLeft === 0}
                  onChange={(event) => setText(event.target.value)}
                  placeholder={locked ? "请等待当前轮次结束" : "也可以输入文字回应"}
                  value={text}
                />
                <GlowButton disabled={locked || !text.trim() || secondsLeft === 0} type="submit">
                  <Send size={18} />
                </GlowButton>
              </div>
            </form>
          </section>
        </div>
      </Panel>
    </Shell>
  );
}
