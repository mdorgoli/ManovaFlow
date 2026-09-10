export const OUTBOUND_CHANNELS = [
  "EMAIL",
  "WHATSAPP",
  "LINKEDIN",
  "CALL",
  "ADS",
  "LIST_PURCHASE",
  "BOOKING",
  "EXTERNAL_MUTATION"
] as const;

export type OutboundChannel = (typeof OUTBOUND_CHANNELS)[number];

export interface OutboundAttempt {
  channel: OutboundChannel;
  tenantId: string;
  draftId: string;
}

export interface DisabledOutboundResult {
  ok: false;
  code: "OUTBOUND_DISABLED_RESEARCH_ONLY";
  sideEffects: 0;
}

export class DisabledOutboundGateway {
  async send(_attempt: OutboundAttempt): Promise<DisabledOutboundResult> {
    void _attempt;
    return {
      ok: false,
      code: "OUTBOUND_DISABLED_RESEARCH_ONLY",
      sideEffects: 0
    };
  }
}
