import {
  cacheDirectory,
  readAsStringAsync,
  writeAsStringAsync,
  EncodingType
} from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import JSZip from "jszip";
import { LocalDiary } from "./types";
import { loadAllDiaries } from "./storage";

// --- HTML Reader Template ---
function generateDiaryHTML(diary: LocalDiary): string {
  const messagesHTML = diary.messages
    .map((msg) => {
      const role = msg.role === "assistant" ? "AI" : "我";
      const audioHTML = msg.audioPath
        ? `<audio controls src="${msg.audioPath.split("/").pop()}"></audio>`
        : "";
      const text = msg.text || msg.transcript || "";
      return `<div class="message ${msg.role}">
        <strong>${role}</strong>
        <p>${text}</p>
        ${audioHTML}
      </div>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${diary.title}</title>
  <style>
    body { font-family: serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f0e8; color: #2c1810; }
    img { max-width: 100%; border-radius: 8px; }
    .message { margin: 12px 0; padding: 12px; border-radius: 8px; }
    .message.assistant { background: #fff; border-left: 3px solid #c6604a; }
    .message.user { background: #fff; border-left: 3px solid #d4a857; }
    audio { width: 100%; margin-top: 8px; }
    h1 { font-size: 24px; }
    .tags { display: flex; gap: 8px; }
    .tag { background: #e8ddd0; padding: 2px 10px; border-radius: 12px; font-size: 12px; }
  </style>
</head>
<body>
  ${diary.imagePath ? `<img src="cover.jpg" alt="封面">` : ""}
  <h1>${diary.title}</h1>
  <div class="tags">
    ${diary.eventTag ? `<span class="tag">${diary.eventTag}</span>` : ""}
    ${diary.moodTag ? `<span class="tag">${diary.moodTag}</span>` : ""}
  </div>
  <p style="color: #888;font-size:14px">${diary.date}</p>
  <blockquote>${diary.summary}</blockquote>
  <div>${diary.content}</div>
  <hr>
  <h2>对话记录</h2>
  ${messagesHTML}
</body>
</html>`;
}

// --- Export single diary as ZIP ---
export async function shareDiaryZip(diary: LocalDiary): Promise<string> {
  const zip = new JSZip();

  // 1. Generate & Add HTML
  const html = generateDiaryHTML(diary);
  zip.file("index.html", html);

  // 2. Add diary.json metadata
  zip.file("diary.json", JSON.stringify(diary, null, 2));

  // 3. Read and Add photo cover
  if (diary.imagePath) {
    try {
      const base64Photo = await readAsStringAsync(diary.imagePath, {
        encoding: EncodingType.Base64,
      });
      zip.file("cover.jpg", base64Photo, { base64: true });
    } catch (e) {
      console.warn("读取封面图片失败:", e);
    }
  }

  // 4. Read and Add audio wav tracks
  for (const msg of diary.messages) {
    if (msg.audioPath) {
      try {
        const filename = msg.audioPath.split("/").pop();
        if (filename) {
          const base64Audio = await readAsStringAsync(msg.audioPath, {
            encoding: EncodingType.Base64,
          });
          zip.file(filename, base64Audio, { base64: true });
        }
      } catch (e) {
        console.warn(`读取录音文件失败 ${msg.audioPath}:`, e);
      }
    }
  }

  // 5. Generate ZIP base64
  const base64Zip = await zip.generateAsync({ type: "base64" });
  const filenameSafe = (diary.title || "手账日记").replace(/[\\\/:*?"<>|]/g, "_");
  const zipUri = `${cacheDirectory}${filenameSafe}-${diary.date}.zip`;

  // 6. Write ZIP to offline cache and trigger shareSheet
  await writeAsStringAsync(zipUri, base64Zip, {
    encoding: EncodingType.Base64,
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(zipUri);
  } else {
    throw new Error("当前系统不支持分享文件");
  }

  return zipUri;
}

// --- Export all diaries as one batch ZIP ---
export async function exportAllDiariesAsZip(): Promise<string | null> {
  const diaries = await loadAllDiaries();
  const visible = diaries.filter((d) => d.status !== "deleted");
  if (visible.length === 0) return null;

  const zip = new JSZip();

  for (const diary of visible) {
    const folderName = `${diary.date}_${diary.id.slice(-6)}`;
    const folder = zip.folder(folderName);
    if (!folder) continue;

    // 1. Generate & Add HTML
    const html = generateDiaryHTML(diary);
    folder.file("index.html", html);
    folder.file("diary.json", JSON.stringify(diary, null, 2));

    // 2. Add cover photo
    if (diary.imagePath) {
      try {
        const base64Photo = await readAsStringAsync(diary.imagePath, {
          encoding: EncodingType.Base64,
        });
        folder.file("cover.jpg", base64Photo, { base64: true });
      } catch (e) {
        console.warn(`[Batch] 读取封面图片失败 for diary ${diary.id}:`, e);
      }
    }

    // 3. Add audio wav tracks
    for (const msg of diary.messages) {
      if (msg.audioPath) {
        try {
          const filename = msg.audioPath.split("/").pop();
          if (filename) {
            const base64Audio = await readAsStringAsync(msg.audioPath, {
              encoding: EncodingType.Base64,
            });
            folder.file(filename, base64Audio, { base64: true });
          }
        } catch (e) {
          console.warn(`[Batch] 读取录音失败 ${msg.audioPath}:`, e);
        }
      }
    }
  }

  const base64Zip = await zip.generateAsync({ type: "base64" });
  const batchZipUri = `${cacheDirectory}怪咖日记所有备份-${Date.now()}.zip`;

  await writeAsStringAsync(batchZipUri, base64Zip, {
    encoding: EncodingType.Base64,
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(batchZipUri);
  } else {
    throw new Error("当前系统不支持分享文件");
  }

  return batchZipUri;
}

// --- Export diary as self-contained Markdown (with inline base64 cover photo) ---
export async function exportAsMarkdown(diary: LocalDiary): Promise<string> {
  let md = `# ${diary.title}\n\n`;
  md += `> ${diary.date}\n\n`;

  if (diary.eventTag || diary.moodTag) {
    md += `标签：${diary.eventTag || ""} ${diary.moodTag || ""}\n\n`;
  }

  if (diary.imagePath) {
    try {
      const base64 = await readAsStringAsync(diary.imagePath, {
        encoding: EncodingType.Base64,
      });
      md += `![封面照片](data:image/jpeg;base64,${base64})\n\n`;
    } catch (e) {
      console.warn("读取封面图片转Markdown失败:", e);
    }
  }

  md += `## 摘要\n\n${diary.summary}\n\n`;
  md += `## 正文\n\n${diary.content}\n\n`;
  md += `---\n\n## 对话记录\n\n`;

  for (const msg of diary.messages) {
    const role = msg.role === "assistant" ? "**AI**" : "**我**";
    const text = msg.text || msg.transcript || "";
    md += `${role}：${text}\n\n`;
    if (msg.audioPath) {
      md += `> 🎤 *（有一段录音已打包保存在本地沙盒）*\n\n`;
    }
  }

  const filenameSafe = (diary.title || "手账日记").replace(/[\\\/:*?"<>|]/g, "_");
  const mdUri = `${cacheDirectory}${filenameSafe}-${diary.date}.md`;

  await writeAsStringAsync(mdUri, md);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(mdUri);
  } else {
    throw new Error("当前系统不支持分享文件");
  }

  return mdUri;
}
