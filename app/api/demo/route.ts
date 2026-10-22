import { connection } from "next/server";
import { demoEnabled, SAMPLE_LISTING } from "@/lib/demo";
import { errorResponse } from "@/lib/errors";

// GET -> the labelled sample clear-out (only when DEMO_MODE=true). No AI call, no network, no quota.
// The quote for it is calculated by /api/quote like any other inventory.
export async function GET() {
  await connection();
  if (!demoEnabled()) return errorResponse("DEMO_DISABLED");
  return Response.json({ source: "sample", ...SAMPLE_LISTING });
}
