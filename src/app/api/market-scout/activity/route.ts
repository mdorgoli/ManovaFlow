import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-response";
import { authorizeDashboard, authorizeResearchRun } from "@/lib/api-policy";
import { getGrowthRepository } from "@/lib/container";
import { resolveRequestActor } from "@/lib/request-auth";
import {
  buildMarketScoutActivityFeed,
  MarketScoutActivityReadModelError
} from "@/modules/growth/application/market-scout-activity-read-model";
import {
  SF_DEMO_1B_IDEMPOTENCY_KEY,
  SfDemo1BExecutionError,
  SfDemo1BExecutor
} from "@/modules/growth/application/sf-demo-1b-execution";
import { OverpassMarketScoutSource } from "@/modules/growth/infrastructure/overpass-market-scout-source";
import { PublicWebsiteReviewer } from "@/modules/growth/infrastructure/public-website-reviewer";

export const dynamic = "force-dynamic";

const commandSchema = z.strictObject({ scope: z.literal("SF-DEMO-1B") });
const executor = new SfDemo1BExecutor();

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const actor = await resolveRequestActor(request);
    authorizeDashboard(actor, request.headers);
    const dashboard = await getGrowthRepository().getDashboard(actor);
    const feed = buildMarketScoutActivityFeed(actor, dashboard);
    return NextResponse.json(feed, {
      headers: { "cache-control": "private, no-store" }
    });
  } catch (error) {
    if (error instanceof MarketScoutActivityReadModelError) {
      return NextResponse.json(
        {
          error: {
            code: "MARKET_SCOUT_ACTIVITY_UNAVAILABLE",
            message: "Market Scout activity is unavailable"
          }
        },
        {
          status: 503,
          headers: { "cache-control": "private, no-store" }
        }
      );
    }
    const response = apiError(error);
    response.headers.set("cache-control", "private, no-store");
    return response;
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      {
        error: {
          code: "MARKET_SCOUT_DEMO_DISABLED",
          message: "Market Scout live demo execution is disabled in production"
        }
      },
      {
        status: 503,
        headers: { "cache-control": "private, no-store" }
      }
    );
  }

  try {
    const actor = await resolveRequestActor(request);
    const idempotencyKey = authorizeResearchRun(actor, request.headers);
    if (idempotencyKey !== SF_DEMO_1B_IDEMPOTENCY_KEY) {
      throw new Error("SF-DEMO-1B requires its fixed idempotency key");
    }
    commandSchema.parse(await request.json());
    const result = await executor.execute({
      actor,
      repository: getGrowthRepository(),
      source: new OverpassMarketScoutSource(),
      websiteReviewer: new PublicWebsiteReviewer()
    });
    return NextResponse.json(result, {
      status: result.disposition === "CREATED" ? 201 : 200,
      headers: { "cache-control": "private, no-store" }
    });
  } catch (error) {
    if (error instanceof SfDemo1BExecutionError) {
      return NextResponse.json(
        {
          error: {
            code: "MARKET_SCOUT_EXECUTION_UNAVAILABLE",
            message: "Market Scout demo execution is unavailable"
          }
        },
        {
          status: 503,
          headers: { "cache-control": "private, no-store" }
        }
      );
    }
    const response = apiError(error);
    response.headers.set("cache-control", "private, no-store");
    return response;
  }
}
