import { env } from "@/lib/env";

const baseUrl = "https://open.bigmodel.cn/api/paas/v4";
const visionModel = env.glmVisionModel;
const chatModel = "glm-4-flash-250414";
const asrModel = "glm-asr-2512";
const ttsModel = "glm-tts";
const chatTimeoutMs = 25_000;
const speechTimeoutMs = 35_000;
const transcriptionTimeoutMs = 30_000;

function getApiKey() {
  if (!env.glmApiKey) {
    throw new Error("GLM_API_KEY is required");
  }
  return env.glmApiKey;
}

export async function generateOpeningFromImage(imageBytes: Buffer, mimeType: string) {
  const imageUrl = `data:${mimeType};base64,${imageBytes.toString("base64")}`;
  const response = await postJson("/chat/completions", {
    model: visionModel,
    messages: [
      {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: imageUrl } },
          {
            type: "text",
            text:
              "你像朋友一样和用户聊这张图片。用简体中文说一句轻松开场，再问一个容易回答的问题；总共 35 字左右，不要长篇描述，不要编造看不见的信息。"
          }
        ]
      }
    ],
    thinking: { type: "disabled" },
    temperature: 0.35,
    max_tokens: 80
  });

  return requireSpeechText(readChatContent(response), "GLM vision returned empty content");
}

export async function generateAssistantReply(history: Array<{ role: "user" | "assistant"; text: string }>) {
  const response = await postJson("/chat/completions", {
    model: chatModel,
    messages: [
      {
        role: "system",
        content:
          "你是一个温柔的 AI 语音日记陪伴者。每次只问 1 到 2 个问题，不编造事实，不强迫隐私。回复要适合被中文语音读出来。"
      },
      ...history.map((item) => ({
        role: item.role,
        content: item.text
      }))
    ],
    temperature: 0.8,
    max_tokens: 220
  });

  return cleanSpeechText(readChatContent(response), "我在听。你愿意再多说一点吗？");
}

export async function generateSummary(history: Array<{ role: "user" | "assistant"; text: string }>) {
  if (history.length === 0) return "";

  const response = await postJson("/chat/completions", {
    model: chatModel,
    messages: [
      {
        role: "system",
        content:
          "你是一个 AI 语音日记助手。根据以下对话，用第一人称写一句话的日记摘要，不要 JSON，不要多余格式。"
      },
      ...history.map((item) => ({
        role: item.role,
        content: item.text
      }))
    ],
    temperature: 0.6,
    max_tokens: 100
  });

  const text = readChatContent(response)?.trim();
  return text?.replace(/^["“”]+|["“”]+$/g, "").trim() || "";
}

export async function transcribeAudio(audioBytes: Buffer, mimeType: string) {
  const form = new FormData();
  const audioFileBytes = audioBytes.buffer.slice(audioBytes.byteOffset, audioBytes.byteOffset + audioBytes.byteLength) as ArrayBuffer;
  form.append("model", asrModel);
  form.append("stream", "false");
  
  let extension = "wav";
  const lowerMime = (mimeType || "").toLowerCase();
  if (lowerMime.includes("m4a") || lowerMime.includes("mp4")) extension = "m4a";
  else if (lowerMime.includes("aac")) extension = "aac";
  else if (lowerMime.includes("amr")) extension = "amr";
  else if (lowerMime.includes("mpeg") || lowerMime.includes("mp3")) extension = "mp3";
  
  form.append("file", new Blob([audioFileBytes], { type: mimeType || "audio/wav" }), `voice-message.${extension}`);

  const response = await fetchWithTimeout(
    `${baseUrl}/audio/transcriptions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getApiKey()}`
      },
      body: form
    },
    transcriptionTimeoutMs,
    "GLM ASR"
  );

  const text = await response.text();
  if (!response.ok) {
    throw new Error(readErrorMessage(text, response.status));
  }

  const data = parseJson(text);
  return cleanSpeechText(readTranscript(data), "");
}

export async function textToSpeech(text: string) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await requestTextToSpeech(text);
    } catch (error) {
      lastError = error;
      if (!isRetryableGlmError(error) || attempt === 2) break;
      await sleep(700 * (attempt + 1));
    }
  }

  throw lastError instanceof Error ? lastError : new Error("GLM TTS failed");
}

async function requestTextToSpeech(text: string) {
  const response = await fetchWithTimeout(
    `${baseUrl}/audio/speech`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getApiKey()}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: ttsModel,
        input: text,
        voice: env.glmTtsVoice,
        response_format: "wav",
        speed: 1,
        stream: false,
        volume: 1,
        watermark_enabled: false
      })
    },
    speechTimeoutMs,
    "GLM TTS"
  );

  const contentType = response.headers.get("content-type") ?? "";
  if (!response.ok) {
    const raw = await response.text();
    throw new Error(readErrorMessage(raw, response.status));
  }

  if (contentType.includes("application/json")) {
    return decodeAudioPayload(parseJson(await response.text()), contentType);
  }

  if (contentType.startsWith("text/")) {
    return decodeAudioPayload(await response.text(), contentType);
  }

  const audio = Buffer.from(await response.arrayBuffer());
  return {
    audio,
    mimeType: inferAudioMimeType(audio, contentType)
  };
}

export function isTextToSpeechCapacityError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  return /GLM API (?:429|5\d\d)|访问量过大|稍后再试|rate limit|too many requests/i.test(message);
}

async function postJson(path: string, body: unknown) {
  const response = await fetchWithTimeout(
    `${baseUrl}${path}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getApiKey()}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    },
    chatTimeoutMs,
    "GLM chat"
  );

  const text = await response.text();
  if (!response.ok) {
    throw new Error(readErrorMessage(text, response.status));
  }
  return parseJson(text);
}

function parseJson(value: string) {
  try {
    return JSON.parse(value) as any;
  } catch {
    return {};
  }
}

export function readChatContent(value: Record<string, any>) {
  const content = value.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((item) => item?.text ?? item?.content ?? "").join("");
  }
  return "";
}

function readTranscript(value: Record<string, any>) {
  if (typeof value.text === "string") return value.text;
  const content = value.choices?.[0]?.message?.content;
  return typeof content === "string" ? content : "";
}

function readErrorMessage(raw: string, status: number) {
  const data = parseJson(raw);
  const message = data.error?.message || data.message || data.msg || raw;
  return `GLM API ${status}: ${message}`;
}

function isRetryableGlmError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  return /GLM API (?:408|409|425|429|5\d\d)|访问量过大|稍后再试|rate limit|too many requests/i.test(message);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(input: string, init: RequestInit, ms: number, label: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`${label} timed out after ${Math.round(ms / 1000)}s`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function cleanSpeechText(value: string | undefined, fallback: string) {
  const text = value?.trim();
  return text ? text.replace(/^["“”]+|["“”]+$/g, "").trim() : fallback;
}

function requireSpeechText(value: string | undefined, message: string) {
  const text = value?.trim().replace(/^["“”]+|["“”]+$/g, "").trim();
  if (!text) throw new Error(message);
  return text;
}

function decodeAudioPayload(value: unknown, contentType: string) {
  const encoded = readEncodedAudio(value);
  if (!encoded) throw new Error("GLM TTS returned no audio");

  const dataUrlMatch = encoded.match(/^data:([^;,]+)(?:;[^,]*)?,([\s\S]+)$/);
  const mimeTypeFromDataUrl = dataUrlMatch?.[1];
  const base64 = (dataUrlMatch?.[2] ?? encoded).replace(/\s/g, "");
  const audio = Buffer.from(base64, "base64");

  return {
    audio,
    mimeType: inferAudioMimeType(audio, mimeTypeFromDataUrl || contentType)
  };
}

function readEncodedAudio(value: unknown): string {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";
  const data = value as Record<string, any>;
  if (typeof data.audio === "string") return data.audio;
  if (typeof data.data === "string") return data.data;
  if (typeof data.output === "string") return data.output;
  const messageAudio = data.choices?.[0]?.message?.audio?.data;
  return typeof messageAudio === "string" ? messageAudio : "";
}

function inferAudioMimeType(audio: Buffer, fallback: string) {
  if (audio.length >= 12 && audio.toString("ascii", 0, 4) === "RIFF" && audio.toString("ascii", 8, 12) === "WAVE") {
    return "audio/wav";
  }
  if (audio.length >= 3 && audio.toString("ascii", 0, 3) === "ID3") return "audio/mpeg";
  if (audio.length >= 2 && audio[0] === 0xff && (audio[1] & 0xe0) === 0xe0) return "audio/mpeg";
  if (audio.length >= 4 && audio.toString("ascii", 0, 4) === "OggS") return "audio/ogg";
  if (audio.length >= 4 && audio.toString("ascii", 0, 4) === "fLaC") return "audio/flac";
  return fallback.split(";")[0] || "audio/wav";
}
