import path from "path";
import { db } from "@/lib/db";
import { shots, characters, storyboardVersions } from "@/lib/db/schema";
import { resolveVideoProvider } from "@/lib/ai/provider-factory";
import type { ModelConfigPayload } from "@/lib/ai/provider-factory";
import { buildVideoPrompt } from "@/lib/ai/prompts/video-generate";
import { eq } from "drizzle-orm";
import type { Task } from "@/lib/task-queue";

async function getVersionedUploadDirFromPipeline(versionId: string | null | undefined): Promise<string> {
  if (!versionId) return process.env.UPLOAD_DIR || "./uploads";
  const [version] = await db
    .select({ label: storyboardVersions.label, projectId: storyboardVersions.projectId })
    .from(storyboardVersions)
    .where(eq(storyboardVersions.id, versionId));
  if (!version) return process.env.UPLOAD_DIR || "./uploads";
  return path.join(process.env.UPLOAD_DIR || "./uploads", "projects", version.projectId, version.label);
}

export async function handleVideoGenerate(task: Task) {
  const payload = task.payload as { shotId: string; ratio?: string; modelConfig?: ModelConfigPayload };

  const [shot] = await db
    .select()
    .from(shots)
    .where(eq(shots.id, payload.shotId));

  if (!shot) throw new Error("Shot not found");
  if (!shot.firstFrame || !shot.lastFrame) {
    throw new Error("Shot frames not generated yet");
  }

  const projectCharacters = await db
    .select()
    .from(characters)
    .where(eq(characters.projectId, shot.projectId));
  const characterDescriptions = projectCharacters
    .map((c) => `${c.name}: ${c.description}`)
    .join("\n");

  const versionedUploadDir = await getVersionedUploadDirFromPipeline(shot.versionId);
  const videoProvider = resolveVideoProvider(payload.modelConfig, versionedUploadDir);

  await db
    .update(shots)
    .set({ status: "generating" })
    .where(eq(shots.id, payload.shotId));

  const videoScript = shot.videoScript || shot.motionScript || shot.prompt || "";
  const prompt = buildVideoPrompt({
    videoScript,
    cameraDirection: shot.cameraDirection || "static",
    startFrameDesc: shot.startFrameDesc ?? undefined,
    endFrameDesc: shot.endFrameDesc ?? undefined,
    duration: shot.duration ?? 10,
  });

  const result = await videoProvider.generateVideo({
    firstFrame: shot.firstFrame,
    lastFrame: shot.lastFrame,
    prompt,
    duration: shot.duration ?? 10,
    ratio: payload.ratio ?? "16:9",
  });

  await db
    .update(shots)
    .set({ videoUrl: result.filePath, status: "completed" })
    .where(eq(shots.id, payload.shotId));

  return { videoPath: result.filePath };
}
