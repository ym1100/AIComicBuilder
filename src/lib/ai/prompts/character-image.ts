export function buildCharacterTurnaroundPrompt(description: string): string {
  return `Professional character model sheet — production-quality reference illustration for animation pipeline.

=== CHARACTER ===
${description}

=== LAYOUT ===
Four orthographic views arranged LEFT to RIGHT on a single canvas:
1. FRONT VIEW (facing camera directly)
2. 3/4 VIEW (turned ~45° to the right)
3. SIDE VIEW (perfect 90° profile, facing right)
4. BACK VIEW (facing away from camera)

=== ARTISTIC REQUIREMENTS ===
Style: MATCH the art style described in the character description above. If the description says "photorealistic/写实真人", render as a photorealistic human (like a real photograph or high-end CG). If it says "anime/动漫", render in anime style. If it says "cartoon", render in cartoon style. NEVER default to anime if the description specifies realistic.
Consistency: ALL four views must depict the EXACT same character with identical proportions, outfit, colors, and details
Proportions: Clean, accurate anatomy matching the specified style. Each view must be the same height — align feet and head across all four poses.
Pose: Neutral standing pose in all views (arms slightly away from body to show costume detail). Relaxed, natural posture.
Expression: Neutral-to-gentle expression in front and 3/4 views. Show the character's personality subtly through their resting expression.
Clothing: Render fabric textures, folds, and material differences (leather vs cotton vs metal, etc.)
Colors: Vivid, well-separated color palette. Maintain exact color consistency across all views.
Background: Pure clean white (#FFFFFF). No gradients, no environment, no shadows on background.
Lighting: Soft, even studio lighting from slightly above and in front. Minimal shadows to keep details readable.
Quality: Professional quality, no artifacts. This is the definitive reference that all future frames must match.`;
}
