import {
  generateAssistantReply as glmGenerateAssistantReply,
  generateOpeningFromImage as glmGenerateOpeningFromImage,
  generateSummary as glmGenerateSummary,
  transcribeAudio as glmTranscribeAudio
} from "@/lib/ai/glm";

type ChatHistory = Array<{ role: "user" | "assistant"; text: string }>;
type AssistantResult = {
  transcript: string;
  notice?: string;
};

export async function generateOpeningFromImage(imageBytes: Buffer, mimeType: string): Promise<AssistantResult> {
  return {
    transcript: await glmGenerateOpeningFromImage(imageBytes, mimeType)
  };
}

export async function generateAssistantReply(history: ChatHistory): Promise<AssistantResult> {
  return {
    transcript: await glmGenerateAssistantReply(history)
  };
}

export async function transcribeAudio(audioBytes: Buffer, mimeType: string): Promise<AssistantResult> {
  return {
    transcript: await glmTranscribeAudio(audioBytes, mimeType)
  };
}

export async function generateSummary(history: ChatHistory): Promise<string> {
  return glmGenerateSummary(history);
}
