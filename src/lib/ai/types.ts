export interface TextOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

export interface ImageOptions {
  model?: string;
  size?: string;
  aspectRatio?: string;
  quality?: string;
  referenceImages?: string[];
}

export interface AIProvider {
  generateText(prompt: string, options?: TextOptions): Promise<string>;
  generateImage(prompt: string, options?: ImageOptions): Promise<string>;
}

// Keyframe mode: both firstFrame and lastFrame must be provided
type KeyframeVideoParams = {
  firstFrame: string;
  lastFrame: string;
  charRefImages?: never;
};

// Reference image mode: charRefImages must be provided (local file paths)
type ReferenceVideoParams = {
  firstFrame?: never;
  lastFrame?: never;
  charRefImages: string[];
};

export type VideoGenerateParams = (KeyframeVideoParams | ReferenceVideoParams) & {
  prompt: string;
  duration: number;
  ratio: string;  // required; callers must provide (default "16:9" at call site)
};

export interface VideoProvider {
  generateVideo(params: VideoGenerateParams): Promise<string>;
}
