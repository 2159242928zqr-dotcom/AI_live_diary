import { Platform } from "react-native";

const ZHIPU_BASE_URL = "https://open.bigmodel.cn/api/paas/v4";

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

// 辅助方法：生成 Bearer 鉴权头
function getHeaders(apiKey: string) {
  return {
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

// 1. 文字转语音 (TTS) 接口调用，返回 base64 形式的 dataUrl
export async function localTextToSpeech(text: string, apiKey: string): Promise<string> {
  const url = `${ZHIPU_BASE_URL}/audio/speech`;
  
  const response = await fetch(url, {
    method: "POST",
    headers: getHeaders(apiKey),
    body: JSON.stringify({
      model: "glm-tts",
      input: text,
      voice: "xiaochen",
      response_format: "wav",
    }),
  });

  if (!response.ok) {
    const raw = await response.text();
    throw new Error(`TTS API 错误: ${raw || response.status}`);
  }

  // 在 React Native 环境中，使用 response.blob() 读取二进制流
  const blob = await response.blob();

  // 使用 FileReader 转为 Base64 Data URL
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("音频数据转换失败"));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

// 2. 语音转文字 (ASR) 接口调用，返回识别的文本
export async function localAudioToText(audioUri: string, apiKey: string): Promise<string> {
  const url = `${ZHIPU_BASE_URL}/audio/transcriptions`;
  const form = new FormData();
  form.append("model", "glm-asr-2512");
  form.append("stream", "false");
  
  // 根据实际音频扩展名进行自适应，保证 Zhipu 接口能正确解包
  let type = "audio/wav";
  let name = "voice-message.wav";
  
  const extMatch = audioUri.match(/\.(\w+)$/);
  if (extMatch && extMatch[1]) {
    const ext = extMatch[1].toLowerCase();
    if (ext === "m4a") {
      type = "audio/mp4";
      name = "voice-message.m4a";
    } else if (ext === "aac") {
      type = "audio/aac";
      name = "voice-message.aac";
    } else if (ext === "amr") {
      type = "audio/amr";
      name = "voice-message.amr";
    } else if (ext === "mp3") {
      type = "audio/mpeg";
      name = "voice-message.mp3";
    }
  }

  form.append("file", {
    uri: Platform.OS === "ios" ? audioUri.replace("file://", "") : audioUri,
    type,
    name,
  } as any);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      // 注意：React Native 上传 FormData 时，不需要手动设置 Content-Type，由 fetch 自动生成带 boundary 的头
    },
    body: form,
  });

  if (!response.ok) {
    const raw = await response.text();
    throw new Error(`ASR API 错误: ${raw || response.status}`);
  }

  const data = await response.json();
  return data.text || "";
}

// 3. 多模态视觉解析开场白 (Vision -> Text -> TTS)
export async function localAiStart(imageDataUrl: string, apiKey: string): Promise<any> {
  const url = `${ZHIPU_BASE_URL}/chat/completions`;
  
  const response = await fetch(url, {
    method: "POST",
    headers: getHeaders(apiKey),
    body: JSON.stringify({
      model: "glm-4v-flash",
      messages: [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: imageDataUrl } },
            {
              type: "text",
              text: "你像朋友一样和用户聊这张图片。用简体中文说一句轻松开场，再问一个容易回答的问题；总共 35 字左右，不要长篇描述，不要编造看不见的信息。"
            }
          ]
        }
      ],
      temperature: 0.35,
      max_tokens: 80,
    }),
  });

  if (!response.ok) {
    const raw = await response.text();
    throw new Error(`Vision API 错误: ${raw || response.status}`);
  }

  const data = await response.json();
  const transcript = data.choices?.[0]?.message?.content || "";
  
  if (!transcript.trim()) {
    throw new Error("AI 识图返回内容为空");
  }

  // 转成语音
  const audioUrl = await localTextToSpeech(transcript, apiKey);

  return {
    assistant_message: {
      id: `msg-ai-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      role: "assistant",
      inputType: "ai_voice",
      transcript: transcript.replace(/^["“”]+|["“”]+$/g, "").trim(),
      audioUrl: audioUrl,
      createdAt: new Date().toISOString()
    },
    voice_notice: "本地直连 AI 开场语音生成就绪。"
  };
}

// 4. 对话文字处理 (Chat -> Text -> TTS)
export async function localAiText(content: string, history: ChatMessage[], apiKey: string): Promise<any> {
  const url = `${ZHIPU_BASE_URL}/chat/completions`;
  
  // 清洗并过滤历史记录，排除非空或不支持的 Role / 文本内容
  const cleanMessages = (history || [])
    .map((item) => {
      const role = item.role === "assistant" ? "assistant" : item.role === "user" ? "user" : null;
      const text = (item.text || "").trim();
      return { role, content: text };
    })
    .filter((item) => item.role && item.content); // 仅保留非空的消息

  const response = await fetch(url, {
    method: "POST",
    headers: getHeaders(apiKey),
    body: JSON.stringify({
      model: "glm-4-flash",
      messages: [
        {
          role: "system",
          content: "你是一个温柔的 AI 语音日记陪伴者。每次只问 1 到 2 个问题，不编造事实，不强迫隐私。回复要适合被中文语音读出来。"
        },
        ...cleanMessages
      ],
      temperature: 0.8,
      max_tokens: 220,
    }),
  });

  if (!response.ok) {
    const raw = await response.text();
    throw new Error(`Chat API 错误: ${raw || response.status}`);
  }

  const data = await response.json();
  const transcript = data.choices?.[0]?.message?.content || "";
  
  if (!transcript.trim()) {
    throw new Error("AI 对话返回内容为空");
  }

  // 转成语音
  const audioUrl = await localTextToSpeech(transcript, apiKey);

  return {
    user_message: {
      id: `msg-user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      role: "user",
      inputType: "text",
      text: content,
      createdAt: new Date().toISOString()
    },
    assistant_message: {
      id: `msg-ai-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      role: "assistant",
      inputType: "ai_voice",
      transcript: transcript.replace(/^["“”]+|["“”]+$/g, "").trim(),
      audioUrl: audioUrl,
      createdAt: new Date().toISOString()
    },
    voice_notice: "本地直连 AI 回复就绪。"
  };
}

// 5. 对话语音处理 (ASR -> Chat -> TTS)
export async function localAiVoice(audioUri: string, history: ChatMessage[], apiKey: string): Promise<any> {
  // ASR 转写
  const userText = await localAudioToText(audioUri, apiKey);
  
  if (!userText.trim()) {
    throw new Error("未能识别到您的语音内容，请重试");
  }

  // 组装新历史记录并调用文本回复
  const updatedHistory: ChatMessage[] = [
    ...history,
    { role: "user", text: userText }
  ];

  const result = await localAiText(userText, updatedHistory, apiKey);
  
  return {
    user_message: {
      id: `msg-user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      role: "user",
      inputType: "voice",
      transcript: userText,
      createdAt: new Date().toISOString()
    },
    assistant_message: result.assistant_message,
    voice_notice: "本地直连 AI 语音交互完成。"
  };
}

// 6. 日记摘要总结 (Summary)
export async function localAiGenerate(messages: ChatMessage[], apiKey: string): Promise<any> {
  if (!messages || messages.length === 0) {
    return { summary: "" };
  }

  const url = `${ZHIPU_BASE_URL}/chat/completions`;
  
  // 清洗并过滤历史记录
  const cleanMessages = messages
    .map((item) => {
      const role = item.role === "assistant" ? "assistant" : item.role === "user" ? "user" : null;
      const text = (item.text || "").trim();
      return { role, content: text };
    })
    .filter((item) => item.role && item.content);

  const response = await fetch(url, {
    method: "POST",
    headers: getHeaders(apiKey),
    body: JSON.stringify({
      model: "glm-4-flash",
      messages: [
        {
          role: "system",
          content: "你是一个 AI 语音日记助手。根据以下对话，用第一人称写一句话的日记摘要，不要 JSON，不要多余格式。"
        },
        ...cleanMessages
      ],
      temperature: 0.6,
      max_tokens: 100,
    }),
  });

  if (!response.ok) {
    const raw = await response.text();
    throw new Error(`Summary API 错误: ${raw || response.status}`);
  }

  const data = await response.json();
  let summary = data.choices?.[0]?.message?.content || "";
  summary = summary.replace(/^["“”]+|["“”]+$/g, "").trim();

  return {
    summary: summary || "一次围绕照片展开的日记聊天，记录当下的真实温度与心跳。"
  };
}
