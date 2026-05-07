import { GoogleGenAI, Type } from "@google/genai";
import { env } from "@/lib/env";

const chatModel = "gemini-2.5-flash";
const ttsModel = "gemini-3.1-flash-tts-preview";

function getClient() {
  if (!env.geminiApiKey) {
    throw new Error("GEMINI_API_KEY is required");
  }
  return new GoogleGenAI({ apiKey: env.geminiApiKey });
}

export async function generateOpeningFromImage(imageBytes: Buffer, mimeType: string) {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: chatModel,
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              data: imageBytes.toString("base64"),
              mimeType
            }
          },
          {
            text:
              "请用简体中文温柔地描述这张图片里较确定的内容，并用一句自然的问题开启语音日记。不要编造，不要一次问太多。"
          }
        ]
      }
    ]
  });
  return response.text ?? "我看到这张照片里有一些值得记录的细节。你想从哪里开始讲起？";
}

export async function generateAssistantReply(history: Array<{ role: "user" | "assistant"; text: string }>) {
  const ai = getClient();
  const prompt = [
    "你是一个温柔的 AI 语音日记陪伴者。每次只问 1 到 2 个问题，不编造事实，不强迫隐私。",
    "请基于以下对话生成下一句 AI 回复，适合被 TTS 读出来：",
    ...history.map((item) => `${item.role}: ${item.text}`)
  ].join("\n");
  const response = await ai.models.generateContent({
    model: chatModel,
    contents: prompt
  });
  return response.text ?? "我在听。你愿意再多说一点吗？";
}

export async function transcribeAudio(audioBytes: Buffer, mimeType: string) {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: chatModel,
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { data: audioBytes.toString("base64"), mimeType } },
          { text: "请把这段音频转写成简体中文，只输出转写文本。" }
        ]
      }
    ]
  });
  return response.text ?? "";
}

export async function generateDiarySummary(history: Array<{ role: "user" | "assistant"; text: string }>) {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: chatModel,
    contents: [
      "请把以下语音日记对话整理成用户第一人称日记，输出 JSON，字段为 title、summary、content。",
      ...history.map((item) => `${item.role}: ${item.text}`)
    ].join("\n"),
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          summary: { type: Type.STRING },
          content: { type: Type.STRING }
        },
        required: ["title", "summary", "content"]
      }
    }
  });
  return JSON.parse(response.text ?? "{}") as { title: string; summary: string; content: string };
}

export async function textToSpeech(text: string) {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: ttsModel,
    contents: [{ parts: [{ text: `请用温柔、自然、陪伴感的中文女声读出：${text}` }] }],
    config: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: "Kore" }
        }
      }
    }
  });
  const data = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!data) throw new Error("Gemini TTS returned no audio");
  return Buffer.from(data, "base64");
}
