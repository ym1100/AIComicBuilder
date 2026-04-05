import { db } from "@/lib/db";
import { shots } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { checkContinuity } from "@/lib/pipeline/continuity-check";
import { resolveAIProvider } from "@/lib/ai/provider-factory";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  // Get all shots with frames, ordered by sequence
  const allShots = await db
    .select()
    .from(shots)
    .where(eq(shots.projectId, id))
    .orderBy(asc(shots.sequence));

  const shotsWithFrames = allShots.filter(
    (s: typeof allShots[number]) => s.lastFrame && s.firstFrame
  );

  if (shotsWithFrames.length < 2) {
    return NextResponse.json({ results: [], message: "Need at least 2 shots with frames" });
  }

  // Resolve text provider for vision analysis
  const provider = resolveAIProvider(body.modelConfig);

  const results: {
    shotASequence: number;
    shotBSequence: number;
    pass: boolean;
    issues: string[];
  }[] = [];

  for (let i = 0; i < shotsWithFrames.length - 1; i++) {
    const current = shotsWithFrames[i];
    const next = shotsWithFrames[i + 1];

    if (current.lastFrame && next.firstFrame) {
      const result = await checkContinuity(
        provider,
        current.lastFrame,
        next.firstFrame
      );
      results.push({
        shotASequence: current.sequence,
        shotBSequence: next.sequence,
        pass: result.pass,
        issues: result.issues,
      });
    }
  }

  return NextResponse.json({ results });
}
