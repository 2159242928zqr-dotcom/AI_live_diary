import { textToSpeech as glmTextToSpeech } from "@/lib/ai/glm";

export type SpeechProvider = "glm";

export async function synthesizeAssistantSpeech(
  text: string
): Promise<{ audio: Buffer; mimeType: string; provider: SpeechProvider; notice?: string }> {
  const speech = await glmTextToSpeech(text);
  return {
    audio: smoothWavEdges(speech.audio),
    mimeType: speech.mimeType,
    provider: "glm"
  };
}

function smoothWavEdges(audio: Buffer) {
  if (audio.length < 48 || audio.toString("ascii", 0, 4) !== "RIFF" || audio.toString("ascii", 8, 12) !== "WAVE") {
    return audio;
  }

  const formatOffset = audio.indexOf(Buffer.from("fmt "));
  const dataOffset = audio.indexOf(Buffer.from("data"));
  if (formatOffset < 0 || dataOffset < 0 || dataOffset + 8 >= audio.length) return audio;

  const audioFormat = audio.readUInt16LE(formatOffset + 8);
  const channels = audio.readUInt16LE(formatOffset + 10);
  const sampleRate = audio.readUInt32LE(formatOffset + 12);
  const bitsPerSample = audio.readUInt16LE(formatOffset + 22);
  if (audioFormat !== 1 || channels < 1 || bitsPerSample !== 16 || sampleRate < 8000) return audio;

  const next = Buffer.from(audio);
  const dataStart = dataOffset + 8;
  const dataSize = Math.min(next.readUInt32LE(dataOffset + 4), next.length - dataStart);
  const frameBytes = channels * 2;
  const frameCount = Math.floor(dataSize / frameBytes);
  const fadeFrames = Math.min(frameCount / 2, Math.round(sampleRate * 0.2));

  for (let frame = 0; frame < fadeFrames; frame += 1) {
    const headGain = frame / fadeFrames;
    const tailGain = (fadeFrames - frame) / fadeFrames;
    const headOffset = dataStart + frame * frameBytes;
    const tailOffset = dataStart + (frameCount - frame - 1) * frameBytes;

    for (let channel = 0; channel < channels; channel += 1) {
      const headSampleOffset = headOffset + channel * 2;
      const tailSampleOffset = tailOffset + channel * 2;
      next.writeInt16LE(Math.round(next.readInt16LE(headSampleOffset) * headGain), headSampleOffset);
      next.writeInt16LE(Math.round(next.readInt16LE(tailSampleOffset) * tailGain), tailSampleOffset);
    }
  }

  return next;
}
