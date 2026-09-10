import { describe, expect, it } from "vitest";
import {
  DisabledOutboundGateway,
  OUTBOUND_CHANNELS
} from "@/modules/growth/infrastructure/outbound-gateway";

describe("Research-Only outbound boundary", () => {
  it.each(OUTBOUND_CHANNELS)("fails closed for %s", async (channel) => {
    const gateway = new DisabledOutboundGateway();

    const result = await gateway.send({
      channel,
      tenantId: "10000000-0000-4000-8000-000000000001",
      draftId: "30000000-0000-4000-8000-000000000001"
    });

    expect(result).toEqual({
      ok: false,
      code: "OUTBOUND_DISABLED_RESEARCH_ONLY",
      sideEffects: 0
    });
    expect(Object.keys(gateway)).toEqual([]);
  });
});
