import { spawn } from "node:child_process";
import { stat } from "node:fs/promises";
import { relative } from "node:path";
import type { BiliDownloadedFile } from "@src/types/video.types";

export interface MuxRequest {
  ffmpegPath: string;
  videoPath: string;
  audioPath: string;
  outputPath: string;
  rootDir: string;
}

export class BiliMuxer {
  async merge(request: MuxRequest): Promise<BiliDownloadedFile> {
    await runFfmpeg(request);
    const file = await stat(request.outputPath);
    return {
      role: "merged",
      path: relative(request.rootDir, request.outputPath),
      absolutePath: request.outputPath,
      sizeBytes: file.size,
      contentType: "video/mp4",
    };
  }
}

function runFfmpeg(request: MuxRequest): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(request.ffmpegPath, [
      "-y",
      "-i",
      request.videoPath,
      "-i",
      request.audioPath,
      "-c",
      "copy",
      request.outputPath,
    ]);
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          `ffmpeg 合并失败，exitCode=${code}: ${stderr.slice(-1000)}`,
        ),
      );
    });
  });
}
