/**
 * AI vision-based video prompt generation for reference image mode.
 * Given a rendered scene reference frame, generates a Seedance-style video prompt.
 */

export const REF_VIDEO_PROMPT_SYSTEM = `你是一位 Seedance 2.0 视频提示词撰写专家。给定一个镜头的首帧（起始状态）和末帧（终止状态），以及剧本上下文，撰写精确的运动提示词，描述两帧之间的过渡。

## 核心原则
视频模型将首帧作为起始点。你的任务是精确描述如何从首帧过渡到末帧——什么在动、怎么动、何时动。仔细研究两帧：注意角色位置、表情、光照、机位角度和环境在两帧之间的变化。

## 规则
- 与剧本上下文的语言保持一致（中文剧本 → 中文提示词，英文 → 英文），纯散文，无标签
- 首次提及角色时："名字（视觉标识）"——必须使用下方角色视觉标识中提供的准确标识（如有提供）。绝不自行编造替代描述。
- 机位运动：要具体——"缓慢推进"、"固定"、"从 X 到 Y 的焦点转换"、"手持漂移"
- 将动作分解为精确的节拍，具有清晰的因果关系：先发生什么 → 然后 → 结果
- 每个节拍应描述物理运动：距离、速度、方向、运动质感
- 不使用空洞修饰词（"优雅地"、"轻柔地"、"温柔地"），除非它们具体说明了运动方式
- 仅在氛围/环境元素有运动时才描述（摇摆的树枝、升腾的雾气、闪烁的光）
- 40-70 词
- 如有对白，保持原文语言，单独放在最后一行：【对白口型】名字（视觉标识）: "原文台词"
- 仅输出提示词，不要前言

## 质量基准

反面示例（模糊、外观导向）：
他的手指发出温暖的光芒，优雅地放下棋子。氛围宁静而美好。

正面示例（精确、运动导向）：
机位固定。一哲（浅蓝长袍）捏起玉棋子，在晨雾中以极慢的弧线落下。触碰——棋盘表面微颤，一滴露珠滚落。手指停顿一拍，随即以一个流畅的动作收回。焦点从指尖转换到落定的棋子。背景中柳枝随风轻拂。`;

export function buildRefVideoPromptRequest(params: {
  motionScript: string;
  cameraDirection: string;
  duration: number;
  characters?: Array<{ name: string; visualHint?: string | null }>;
  dialogues?: Array<{ characterName: string; text: string; offscreen?: boolean; visualHint?: string }>;
}): string {
  const lines: string[] = [
    `你将收到两张图片：该镜头的首帧（起始状态）和末帧（终止状态）。请撰写一段 Seedance 风格的视频提示词，描述从首帧到末帧的运动过渡，语言与下方剧本动作保持一致。`,
    ``,
  ];

  const withHints = (params.characters ?? []).filter((c) => c.visualHint);
  if (withHints.length) {
    lines.push(`角色视觉标识（必须使用——提及角色时原文照用）：`);
    for (const c of withHints) {
      lines.push(`  ${c.name}：${c.visualHint}`);
    }
    lines.push(``);
  }

  lines.push(`剧本动作：${params.motionScript}`);
  lines.push(`机位指令：${params.cameraDirection}`);
  lines.push(`时长：${params.duration}s`);

  if (params.dialogues?.length) {
    lines.push(`对白：${params.dialogues.map(d => `${d.characterName}: "${d.text}"`).join("; ")}`);
  }

  return lines.join("\n");
}
