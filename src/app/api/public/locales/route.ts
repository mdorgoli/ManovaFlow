import { homeLanguageOptions } from "@/components/public-home/home-copy";
import { cachedPublicLocales } from "@/lib/public-cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const result = await cachedPublicLocales(() => ({
    locales: homeLanguageOptions
  }));
  return Response.json(result.value, {
    headers: { "cache-control": "no-store", "x-cache": result.cache }
  });
}
