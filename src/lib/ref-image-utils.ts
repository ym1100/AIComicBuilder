import { id as genId } from "@/lib/id";

export type RefImageType = "first_frame" | "last_frame" | "reference" | "video" | "ref_video" | "scene_ref";

export interface RefImage {
  id: string;
  type: RefImageType;
  prompt: string;
  imagePath?: string;
  status: "pending" | "generated";
  characters?: string[];
  model?: { providerId: string; modelId: string };
  /** All generated versions (paths). Most recent at the end. */
  history?: string[];
}

/**
 * Parse referenceImages JSON from DB, handling both legacy string[] and new RefImage[] formats.
 */
export function parseRefImages(json: string | null | undefined): RefImage[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];

    return parsed.map((item: unknown) => {
      if (typeof item === "string") {
        // Legacy format: plain image path or "prompt:xxx"
        if (item.startsWith("prompt:")) {
          return {
            id: genId(),
            type: "reference" as const,
            prompt: item.replace(/^prompt:/, ""),
            status: "pending" as const,
          };
        }
        return {
          id: genId(),
          type: "reference" as const,
          prompt: "",
          imagePath: item,
          status: "generated" as const,
        };
      }
      // New format: RefImage object
      const obj = item as Record<string, unknown>;
      return {
        id: (obj.id as string) || genId(),
        type: (obj.type as RefImageType) || "reference",
        prompt: (obj.prompt as string) || "",
        imagePath: obj.imagePath as string | undefined,
        status: (obj.status as "pending" | "generated") || (obj.imagePath ? "generated" : "pending"),
        characters: Array.isArray(obj.characters) ? obj.characters as string[] : undefined,
        model: obj.model as { providerId: string; modelId: string } | undefined,
        history: Array.isArray(obj.history) ? obj.history as string[] : undefined,
      };
    });
  } catch {
    return [];
  }
}

/**
 * Serialize RefImage[] back to JSON for DB storage.
 */
export function serializeRefImages(images: RefImage[]): string {
  return JSON.stringify(images);
}

/** Get only first_frame / last_frame items */
export function getFrameItems(images: RefImage[]) {
  return {
    firstFrame: images.find((r) => r.type === "first_frame"),
    lastFrame: images.find((r) => r.type === "last_frame"),
  };
}

/** Get only reference items */
export function getRefItems(images: RefImage[]): RefImage[] {
  return images.filter((r) => r.type === "reference");
}

/** Add a new generated path to history and set as current. */
export function appendToHistory(item: RefImage, newPath: string): RefImage {
  const history = item.history ? [...item.history] : [];
  // Include current imagePath in history if not already there
  if (item.imagePath && !history.includes(item.imagePath)) {
    history.push(item.imagePath);
  }
  if (!history.includes(newPath)) {
    history.push(newPath);
  }
  return {
    ...item,
    imagePath: newPath,
    status: "generated",
    history,
  };
}
