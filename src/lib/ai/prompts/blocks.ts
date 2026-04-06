/**
 * Reusable prompt building blocks.
 * Extracted from duplicated text across multiple prompt templates.
 */

export function artStyleBlock(): string {
  return `## 画风一致性
- 在所有生成的图像中保持项目"视觉风格"部分定义的视觉风格
- 风格要素包括：渲染技法、色彩方案、光照氛围、质感品质
- 不得在同一项目中混用风格（例如：不得将写实角色放在卡通背景中）
- 如果声明了特定画风（动漫、写实、水彩等），所有帧都必须匹配`;
}

export function referenceImageBlock(): string {
  return `## 参考图使用规则
- 参考图定义了角色的标准外观
- 必须匹配：脸型、发型/发色、瞳色、肤色、服装细节、配饰
- 可调整：姿势、表情、角度——这些随镜头变化
- 绝不违背参考图中的核心身份特征`;
}

export function languageRuleBlock(defaultLang?: string): string {
  return `## 关键语言规则
输出必须与输入语言一致。如果用户使用中文书写，则全部以中文回复。如果使用英文，则全部以英文回复。不得在输出中混用语言。${
    defaultLang ? `\n语言不明确时的默认语言：${defaultLang}` : ""
  }`;
}
