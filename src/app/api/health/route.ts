import { getDatabaseClient } from "@/lib/container";
import { getPublicCache } from "@/lib/public-cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  try {
    if (!process.env.DATABASE_URL || !process.env.REDIS_URL)
      throw new Error("Missing dependency");
    const redis = await getPublicCache();
    const [, pong] = await Promise.all([
      getDatabaseClient()`select 1`,
      redis?.ping()
    ]);
    if (pong !== "PONG") throw new Error("Dependency not ready");
    return Response.json(
      { status: "ok" },
      { headers: { "cache-control": "no-store" } }
    );
  } catch {
    return Response.json(
      { status: "unavailable" },
      {
        status: 503,
        headers: { "cache-control": "no-store" }
      }
    );
  }
}
