import { connection } from "next/server";
import { providerConfig } from "@/lib/ai/provider";
import { demoEnabled } from "@/lib/demo";

// GET -> what this deployment can do. Read at request time so a Vercel setting change applies on redeploy
// without code changes. Reveals only yes/no flags: never the provider, model or key.
export async function GET() {
  await connection();
  return Response.json({ analysisConfigured: providerConfig() !== null, demoEnabled: demoEnabled() });
}
