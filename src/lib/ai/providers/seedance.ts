import type { VideoProvider, VideoGenerateParams } from "../types";
import fs from "node:fs";
import path from "node:path";
import { ulid } from "ulid";

function toDataUrl(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase().replace(".", "");
  const mime =
    ext === "jpg" || ext === "jpeg"
      ? "image/jpeg"
      : ext === "png"
        ? "image/png"
        : ext === "webp"
          ? "image/webp"
          : "image/png";
  const base64 = fs.readFileSync(filePath, { encoding: "base64" });
  return `data:${mime};base64,${base64}`;
}

export class SeedanceProvider implements VideoProvider {
  private apiKey: string;
  private baseUrl: string;
  private model: string;
  private uploadDir: string;

  constructor(params?: {
    apiKey?: string;
    baseUrl?: string;
    model?: string;
    uploadDir?: string;
  }) {
    this.apiKey = params?.apiKey || process.env.SEEDANCE_API_KEY || "";
    this.baseUrl = (
      params?.baseUrl ||
      process.env.SEEDANCE_BASE_URL ||
      "https://ark.cn-beijing.volces.com"
    ).replace(/\/+$/, "");
    this.model =
      params?.model || process.env.SEEDANCE_MODEL || "doubao-seedance-1-5-pro-250528";
    this.uploadDir =
      params?.uploadDir || process.env.UPLOAD_DIR || "./uploads";
  }

  async generateVideo(params: VideoGenerateParams): Promise<string> {
    if (!("firstFrame" in params)) {
      throw new Error("Seedance provider only supports keyframe (image2video) mode");
    }
    const { firstFrame, lastFrame } = params as { firstFrame: string; lastFrame: string };
    const firstFrameUrl = toDataUrl(firstFrame);
    const lastFrameUrl = toDataUrl(lastFrame);

    // Build content array per Seedance API spec
    const content: Record<string, unknown>[] = [
      {
        type: "text",
        text: params.prompt,
      },
      {
        type: "image_url",
        image_url: { url: firstFrameUrl },
        role: "first_frame",
      },
      {
        type: "image_url",
        image_url: { url: lastFrameUrl },
        role: "last_frame",
      },
    ];

    const body: Record<string, unknown> = {
      model: this.model,
      content,
      duration: params.duration || 5,
      ratio: params.ratio || "16:9",
      watermark: false,
    };

    console.log(
      `[Seedance] Submitting task: model=${this.model}, duration=${body.duration}, ratio=${body.ratio}`
    );

    const submitResponse = await fetch(
      `${this.baseUrl}/contents/generations/tasks`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
      }
    );

    if (!submitResponse.ok) {
      const errText = await submitResponse.text();
      throw new Error(
        `Seedance submit failed: ${submitResponse.status} ${errText}`
      );
    }

    const submitResult = (await submitResponse.json()) as { id: string };
    console.log(`[Seedance] Task submitted: ${submitResult.id}`);

    const videoUrl = await this.pollForResult(submitResult.id);

    // Download video to local storage
    const videoResponse = await fetch(videoUrl);
    const buffer = Buffer.from(await videoResponse.arrayBuffer());
    const filename = `${ulid()}.mp4`;
    const dir = path.join(this.uploadDir, "videos");
    fs.mkdirSync(dir, { recursive: true });
    const filepath = path.join(dir, filename);
    fs.writeFileSync(filepath, buffer);

    return filepath;
  }

  private async pollForResult(taskId: string): Promise<string> {
    const maxAttempts = 120;
    const interval = 5000;

    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((resolve) => setTimeout(resolve, interval));

      const response = await fetch(
        `${this.baseUrl}/contents/generations/tasks/${taskId}`,
        {
          headers: { Authorization: `Bearer ${this.apiKey}` },
        }
      );

      if (!response.ok) continue;

      const result = (await response.json()) as {
        status: string;
        content?: { video_url?: string };
        error?: { message?: string };
      };

      console.log(`[Seedance] Poll ${i + 1}: status=${result.status}`);

      if (result.status === "succeeded" && result.content?.video_url) {
        return result.content.video_url;
      }
      if (result.status === "failed") {
        throw new Error(
          `Seedance generation failed: ${result.error?.message || "unknown"}`
        );
      }
    }

    throw new Error("Seedance generation timed out after 10 minutes");
  }
}
