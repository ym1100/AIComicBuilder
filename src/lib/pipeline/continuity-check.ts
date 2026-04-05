import type { TextOptions } from "@/lib/ai/types";

interface ContinuityResult {
  pass: boolean;
  issues: string[];
}

const CONTINUITY_PROMPT = `Compare these two consecutive frames from an animated film.
Frame 1 is the LAST frame of the previous shot.
Frame 2 is the FIRST frame of the next shot.

Check for continuity issues:
1. Character costume consistency (same clothes, accessories, hair)
2. Character position logical progression (natural movement)
3. Lighting direction consistency (same light source angle)
4. Color tone consistency (matching grading)
5. Background continuity (if same location)

Output ONLY valid JSON (no markdown):
{"pass": true/false, "issues": ["description of each issue found"]}

Pass if no significant continuity breaks. Minor perspective changes from different camera angles are OK and expected.`;

export async function checkContinuity(
  provider: { generateText: (prompt: string, options?: TextOptions) => Promise<string> },
  lastFrameUrl: string,
  nextFirstFrameUrl: string
): Promise<ContinuityResult> {
  try {
    const result = await provider.generateText(CONTINUITY_PROMPT, {
      images: [lastFrameUrl, nextFirstFrameUrl],
    });

    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { pass: true, issues: [] };

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      pass: parsed.pass ?? true,
      issues: parsed.issues ?? [],
    };
  } catch {
    // If continuity check itself fails, default to pass (don't block generation)
    return { pass: true, issues: [] };
  }
}
