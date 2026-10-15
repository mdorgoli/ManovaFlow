import { describe, expect, it } from "vitest";
import {
  InMemoryServiceFlowRepository,
  ServiceFlowService,
  type ServiceRequestInput,
  type Technician
} from "@/modules/serviceflow";

const tenantA = { tenantId: "tenant-demo-a", actorId: "operator-demo-a" };
const tenantB = { tenantId: "tenant-demo-b", actorId: "operator-demo-b" };

const baseInput: ServiceRequestInput = {
  synthetic: true,
  description: "DEMO: kitchen sink leak; no immediate danger.",
  address: "DEMO_CENTRAL_ZONE",
  service: "PLUMBING_LEAK",
  requestedHour: 10,
  safetyAssessment: "SAFE"
};

function createService(technicians?: readonly Technician[]) {
  let tick = 0;
  let serial = 0;
  const options = technicians ? { technicians } : {};
  return new ServiceFlowService(
    new InMemoryServiceFlowRepository({
      now: () => new Date(1_780_000_000_000 + tick++),
      id: () => `request-${++serial}`
    }),
    options
  );
}

describe("ServiceFlow synthetic intake", () => {
  it("moves a complete safe supported request from new to review with every policy check recorded", async () => {
    const service = createService();

    const result = await service.createAndEvaluate(
      tenantA,
      baseInput,
      "create-0001"
    );

    expect(result.request.state).toBe("REVIEW");
    expect(result.evaluation.checks).toEqual({
      completeness: "PASS",
      service: "PASS",
      serviceArea: "PASS",
      supportedHours: "PASS",
      safety: "PASS"
    });
    expect(result.request.ownerId).toBeNull();
    expect(result.request.assigneeId).toBeNull();
    expect(await service.listAudit(tenantA)).toEqual([
      expect.objectContaining({
        type: "REQUEST_CREATED",
        details: { state: "NEW", synthetic: true }
      }),
      expect.objectContaining({
        type: "REQUEST_EVALUATED",
        details: expect.objectContaining({
          fromState: "NEW",
          toState: "REVIEW",
          checks: {
            completeness: "PASS",
            service: "PASS",
            serviceArea: "PASS",
            supportedHours: "PASS",
            safety: "PASS"
          }
        })
      })
    ]);
  });

  it("puts missing description, address, or service into needs_info without a proposal", async () => {
    const service = createService();

    const result = await service.createAndEvaluate(
      tenantA,
      {
        ...baseInput,
        description: undefined,
        address: undefined,
        service: undefined
      },
      "create-0002"
    );

    expect(result.request.state).toBe("NEEDS_INFO");
    expect(result.evaluation.missingFields).toEqual([
      "description",
      "address",
      "service"
    ]);
    expect(result.evaluation.proposal).toBeNull();
    expect(await service.listAudit(tenantA)).toContainEqual(
      expect.objectContaining({
        type: "REQUEST_EVALUATED",
        details: expect.objectContaining({
          missingFields: ["description", "address", "service"],
          checks: {
            completeness: "FAIL",
            service: "NOT_EVALUATED",
            serviceArea: "NOT_EVALUATED",
            supportedHours: "NOT_EVALUATED",
            safety: "PASS"
          }
        })
      })
    );
  });

  it.each([
    [
      "unsupported service",
      { service: "ROOF_REPLACEMENT" },
      "OUT_OF_SCOPE_SERVICE"
    ],
    [
      "outside service area",
      { address: "DEMO_REMOTE_ZONE" },
      "OUT_OF_SERVICE_AREA"
    ],
    [
      "outside supported hours",
      { requestedHour: 19 },
      "OUTSIDE_SUPPORTED_HOURS"
    ]
  ] as const)("blocks a request for %s", async (_name, change, reason) => {
    const service = createService();

    const result = await service.createAndEvaluate(
      tenantA,
      { ...baseInput, ...change },
      `create-${reason}`
    );

    expect(result.request.state).toBe("BLOCKED");
    expect(result.evaluation.blockReason).toBe(reason);
    expect(result.evaluation.proposal).toBeNull();
  });

  it.each([
    [
      "explicit emergency language",
      {
        description: "DEMO: smoke and fire emergency in the utility room.",
        safetyAssessment: "SAFE"
      },
      "POSSIBLE_EMERGENCY"
    ],
    ["unknown safety", { safetyAssessment: "UNKNOWN" }, "SAFETY_UNKNOWN"]
  ] as const)("fails closed for %s", async (_name, change, reason) => {
    const service = createService();

    const result = await service.createAndEvaluate(
      tenantA,
      { ...baseInput, ...change },
      `create-${reason}`
    );

    expect(result.request.state).toBe("BLOCKED");
    expect(result.evaluation.blockReason).toBe(reason);
    expect(result.evaluation.proposal).toBeNull();
  });

  it("proposes the sole eligible synthetic technician with a versioned explanation", async () => {
    const service = createService([
      technician("DEMO_TECHNICIAN_SOLO", [10]),
      technician("DEMO_TECHNICIAN_INACTIVE", [10], "INACTIVE")
    ]);

    const result = await service.createAndEvaluate(
      tenantA,
      baseInput,
      "create-0003"
    );

    expect(result.evaluation.proposal).toMatchObject({
      technicianId: "DEMO_TECHNICIAN_SOLO",
      policyVersion: "serviceflow-policy-v1",
      ruleVersion: "assignee-proposal-v1"
    });
    expect(result.evaluation.proposal?.explanation).toMatch(
      /active.*skill.*area.*hour/i
    );
  });

  it("uses technician id as a deterministic tie-break for equal eligible candidates", async () => {
    const technicians = [
      technician("DEMO_TECHNICIAN_ZETA", [10]),
      technician("DEMO_TECHNICIAN_ALPHA", [10])
    ];
    const service = createService(technicians);

    const first = await service.createAndEvaluate(
      tenantA,
      baseInput,
      "create-0004"
    );
    const second = await service.createAndEvaluate(
      tenantA,
      baseInput,
      "create-0005"
    );

    expect(first.evaluation.proposal?.technicianId).toBe(
      "DEMO_TECHNICIAN_ALPHA"
    );
    expect(second.evaluation.proposal).toEqual(first.evaluation.proposal);
  });

  it("blocks when no synthetic technician is eligible", async () => {
    const service = createService([
      technician("DEMO_TECHNICIAN_NORTH", [10], "ACTIVE", "DEMO_NORTH_ZONE")
    ]);

    const result = await service.createAndEvaluate(
      tenantA,
      baseInput,
      "create-0006"
    );

    expect(result.request.state).toBe("BLOCKED");
    expect(result.evaluation.blockReason).toBe("NO_ELIGIBLE_ASSIGNEE");
    expect(result.evaluation.proposal).toBeNull();
    expect(
      await service.getExceptionCount(tenantA, "NO_ELIGIBLE_ASSIGNEE")
    ).toBe(1);
    expect(
      await service.getExceptionCount(tenantB, "NO_ELIGIBLE_ASSIGNEE")
    ).toBe(0);

    await service.createAndEvaluate(tenantA, baseInput, "create-0006");
    await service.reEvaluate(tenantA, result.request.id);

    expect(
      await service.getExceptionCount(tenantA, "NO_ELIGIBLE_ASSIGNEE")
    ).toBe(1);
  });

  it("keeps a proposal in review without assignment or outbound side effects", async () => {
    const service = createService();

    const result = await service.createAndEvaluate(
      tenantA,
      baseInput,
      "create-0007"
    );

    expect(result.request.state).toBe("REVIEW");
    expect(result.evaluation.proposal).not.toBeNull();
    expect(result.request.ownerId).toBeNull();
    expect(result.request.assigneeId).toBeNull();
    expect(result.outboundActionCount).toBe(0);
  });

  it("rejects a reused idempotency key bound to a different normalized payload", async () => {
    const service = createService();
    await service.createAndEvaluate(tenantA, baseInput, "create-0008");

    await expect(
      service.createAndEvaluate(
        tenantA,
        { ...baseInput, requestedHour: 11 },
        "create-0008"
      )
    ).rejects.toThrow(
      "Idempotency key is already bound to a different request payload"
    );
  });

  it("replays the same tenant request exactly once without duplicate audit events", async () => {
    const service = createService();

    const first = await service.createAndEvaluate(
      tenantA,
      baseInput,
      "create-0009"
    );
    const auditAfterFirst = await service.listAudit(tenantA);
    const replay = await service.createAndEvaluate(
      tenantA,
      {
        ...baseInput,
        description: "  DEMO: kitchen sink leak; no immediate danger.  ",
        address: "demo_central_zone",
        service: "plumbing_leak"
      },
      "create-0009"
    );

    expect(replay).toEqual(first);
    expect(await service.listAudit(tenantA)).toEqual(auditAfterFirst);
  });

  it("rejects an unbounded or malformed idempotency key before storing a request", async () => {
    const service = createService();

    await expect(
      service.createAndEvaluate(tenantA, baseInput, "short")
    ).rejects.toThrow();
    await expect(service.listRequests(tenantA)).resolves.toEqual([]);
  });

  it("returns the same non-disclosing not-found result for cross-tenant reads and changes", async () => {
    const service = createService();
    const created = await service.createAndEvaluate(
      tenantA,
      baseInput,
      "create-0010"
    );
    const before = await service.listAudit(tenantA);

    await expect(
      service.getRequest(tenantB, created.request.id)
    ).rejects.toThrow("Service request not found");
    await expect(
      service.reEvaluate(tenantB, created.request.id)
    ).rejects.toThrow("Service request not found");

    expect(await service.listAudit(tenantA)).toEqual(before);
    expect(await service.listAudit(tenantB)).toEqual([]);
  });

  it("lets safety fail closed before completeness while SAFE incomplete intake still needs information", async () => {
    const service = createService();
    const emergency = await service.createAndEvaluate(
      tenantA,
      {
        ...baseInput,
        address: undefined,
        service: undefined,
        description: "DEMO: smoke emergency reported."
      },
      "create-safety-001"
    );
    const unknown = await service.createAndEvaluate(
      tenantA,
      {
        ...baseInput,
        description: undefined,
        address: undefined,
        service: undefined,
        safetyAssessment: "UNKNOWN"
      },
      "create-safety-002"
    );
    const incompleteSafe = await service.createAndEvaluate(
      tenantA,
      { ...baseInput, address: undefined, service: undefined },
      "create-safety-003"
    );

    expect(emergency.evaluation.blockReason).toBe("POSSIBLE_EMERGENCY");
    expect(emergency.request.state).toBe("BLOCKED");
    expect(unknown.evaluation.blockReason).toBe("SAFETY_UNKNOWN");
    expect(unknown.request.state).toBe("BLOCKED");
    expect(incompleteSafe.request.state).toBe("NEEDS_INFO");
  });

  it("rejects non-DEMO descriptions, addresses, and common PII-like text at intake", async () => {
    const service = createService();

    await expect(
      service.createAndEvaluate(
        tenantA,
        { ...baseInput, description: "Kitchen leak" },
        "create-demo-001"
      )
    ).rejects.toThrow(/DEMO/i);
    await expect(
      service.createAndEvaluate(
        tenantA,
        { ...baseInput, address: "CENTRAL_ZONE" },
        "create-demo-002"
      )
    ).rejects.toThrow(/DEMO/i);
    await expect(
      service.createAndEvaluate(
        tenantA,
        {
          ...baseInput,
          description: "DEMO: contact person@example.com about leak"
        },
        "create-demo-003"
      )
    ).rejects.toThrow(/personal|contact/i);
    await expect(
      service.createAndEvaluate(
        tenantA,
        { ...baseInput, description: "DEMO: contact 555-123-4567 about leak" },
        "create-demo-004"
      )
    ).rejects.toThrow(/personal|contact/i);
  });

  it("rejects invalid runtime synthetic technician catalogs", () => {
    expect(() =>
      createService([
        {
          ...technician("DEMO_TECHNICIAN_INVALID", [10]),
          synthetic: false
        } as unknown as Technician
      ])
    ).toThrow(/synthetic/i);
    expect(() =>
      createService([technician("TECHNICIAN_INVALID", [10])])
    ).toThrow(/DEMO/i);
    expect(() =>
      createService([
        {
          ...technician("DEMO_TECHNICIAN_DUPLICATE", [10]),
          skills: ["PLUMBING_LEAK", "PLUMBING_LEAK"]
        }
      ])
    ).toThrow(/unique/i);
  });

  it("deep-clones the technician catalog so caller mutation cannot change later evaluations", async () => {
    const catalog = [technician("DEMO_TECHNICIAN_STABLE", [10])];
    const service = createService(catalog);
    catalog[0]!.status = "INACTIVE";
    catalog[0]!.availableHours = [];

    const first = await service.createAndEvaluate(
      tenantA,
      baseInput,
      "create-catalog-001"
    );
    const second = await service.createAndEvaluate(
      tenantA,
      baseInput,
      "create-catalog-002"
    );

    expect(first.evaluation.proposal?.technicianId).toBe(
      "DEMO_TECHNICIAN_STABLE"
    );
    expect(second.evaluation.proposal).toEqual(first.evaluation.proposal);
  });

  it("keeps colliding injected request ids tenant-scoped instead of overwriting either tenant", async () => {
    const repository = new InMemoryServiceFlowRepository({
      now: () => new Date("2026-09-04T00:00:00.000Z"),
      id: sequenceId([
        "deliberately-colliding-id",
        "event-tenant-a-1",
        "event-tenant-a-2",
        "deliberately-colliding-id",
        "event-tenant-b-1",
        "event-tenant-b-2"
      ])
    });
    const service = new ServiceFlowService(repository);

    const first = await service.createAndEvaluate(
      tenantA,
      baseInput,
      "create-collision-a"
    );
    const second = await service.createAndEvaluate(
      tenantB,
      baseInput,
      "create-collision-b"
    );

    expect(first.request.id).toBe(second.request.id);
    expect((await service.getRequest(tenantA, first.request.id)).tenantId).toBe(
      tenantA.tenantId
    );
    expect(
      (await service.getRequest(tenantB, second.request.id)).tenantId
    ).toBe(tenantB.tenantId);
    expect(await service.listRequests(tenantA)).toHaveLength(1);
    expect(await service.listRequests(tenantB)).toHaveLength(1);
  });

  it("rejects a same-tenant generated request id collision before any request, idempotency, or audit mutation", async () => {
    const repository = new InMemoryServiceFlowRepository({
      now: () => new Date("2026-09-04T00:00:00.000Z"),
      id: sequenceId([
        "same-tenant-id",
        "event-same-1",
        "event-same-2",
        "same-tenant-id"
      ])
    });
    const service = new ServiceFlowService(repository);
    const first = await service.createAndEvaluate(
      tenantA,
      baseInput,
      "create-same-id-001"
    );
    const auditBeforeCollision = await service.listAudit(tenantA);

    await expect(
      service.createAndEvaluate(
        tenantA,
        { ...baseInput, requestedHour: 11 },
        "create-same-id-002"
      )
    ).rejects.toThrow("Service request id collision");

    expect(await service.getRequest(tenantA, first.request.id)).toEqual(
      first.request
    );
    expect(await service.listRequests(tenantA)).toHaveLength(1);
    expect(await service.listAudit(tenantA)).toEqual(auditBeforeCollision);
  });

  it("normalizes DEMO: with no content to a missing description", async () => {
    const service = createService();

    const result = await service.createAndEvaluate(
      tenantA,
      { ...baseInput, description: "  DEMO:    " },
      "create-empty-demo-description"
    );

    expect(result.request.state).toBe("NEEDS_INFO");
    expect(result.evaluation.missingFields).toContain("description");
  });

  it("prioritizes explicit hazard language over UNKNOWN safety while unknown without a hazard remains fail-closed", async () => {
    const service = createService();

    const hazard = await service.createAndEvaluate(
      tenantA,
      {
        ...baseInput,
        description: "DEMO: smoke and fire emergency.",
        safetyAssessment: "UNKNOWN"
      },
      "create-hazard-unknown"
    );
    const unknown = await service.createAndEvaluate(
      tenantA,
      { ...baseInput, description: undefined, safetyAssessment: "UNKNOWN" },
      "create-unknown-missing"
    );

    expect(hazard.evaluation.blockReason).toBe("POSSIBLE_EMERGENCY");
    expect(unknown.evaluation.blockReason).toBe("SAFETY_UNKNOWN");
  });

  it.each([
    ["sparking", "DEMO: sparking from the outlet.", "POSSIBLE_EMERGENCY"],
    ["Persian spark", "DEMO: جرقه از پریز دیده می‌شود.", "POSSIBLE_EMERGENCY"],
    ["strange smell", "DEMO: strange smell near the outlet.", "SAFETY_UNKNOWN"],
    [
      "Persian ambiguous smell",
      "DEMO: بوی عجیب نزدیک پریز است.",
      "SAFETY_UNKNOWN"
    ]
  ] as const)(
    "classifies deterministic safety language for %s",
    async (_name, description, expectedReason) => {
      const service = createService();

      const result = await service.createAndEvaluate(
        tenantA,
        { ...baseInput, description, safetyAssessment: "SAFE" },
        `create-safety-vocabulary-${expectedReason}-${_name}`.replaceAll(
          " ",
          "-"
        )
      );

      expect(result.request.state).toBe("BLOCKED");
      expect(result.evaluation.blockReason).toBe(expectedReason);
    }
  );

  it("rejects unsafe actor and generated request identifiers before persistence", async () => {
    const service = createService();
    await expect(
      service.createAndEvaluate(
        { ...tenantA, actorId: "operator\u0000unsafe" },
        baseInput,
        "create-unsafe-actor"
      )
    ).rejects.toThrow();

    const unsafeIdService = new ServiceFlowService(
      new InMemoryServiceFlowRepository({ id: () => "request\u0000unsafe" })
    );
    await expect(
      unsafeIdService.createAndEvaluate(
        tenantA,
        baseInput,
        "create-unsafe-request-id"
      )
    ).rejects.toThrow("Invalid generated service request id");
    expect(await unsafeIdService.listRequests(tenantA)).toEqual([]);
    expect(await unsafeIdService.listAudit(tenantA)).toEqual([]);
  });

  it("rejects an unsafe generated audit event id atomically and permits retry with the same idempotency key", async () => {
    const service = new ServiceFlowService(
      new InMemoryServiceFlowRepository({
        id: sequenceId([
          "request-before-unsafe-event",
          "event\u0000unsafe",
          "request-after-unsafe-event",
          "event-retry-1",
          "event-retry-2"
        ])
      })
    );

    await expect(
      service.createAndEvaluate(tenantA, baseInput, "create-unsafe-event-id")
    ).rejects.toThrow("Invalid generated serviceflow audit event id");
    expect(await service.listRequests(tenantA)).toEqual([]);
    expect(await service.listAudit(tenantA)).toEqual([]);

    await expect(
      service.createAndEvaluate(tenantA, baseInput, "create-unsafe-event-id")
    ).resolves.toMatchObject({ request: { id: "request-after-unsafe-event" } });
  });

  it("rejects duplicate or throwing generated audit event ids without partial create state", async () => {
    const duplicateService = new ServiceFlowService(
      new InMemoryServiceFlowRepository({
        id: sequenceId([
          "request-duplicate-event",
          "event-duplicate",
          "event-duplicate"
        ])
      })
    );
    await expect(
      duplicateService.createAndEvaluate(
        tenantA,
        baseInput,
        "create-duplicate-event-id"
      )
    ).rejects.toThrow("ServiceFlow audit event id collision");
    expect(await duplicateService.listRequests(tenantA)).toEqual([]);
    expect(await duplicateService.listAudit(tenantA)).toEqual([]);

    let idCall = 0;
    const throwingService = new ServiceFlowService(
      new InMemoryServiceFlowRepository({
        id: () => {
          idCall += 1;
          if (idCall === 2) throw new Error("simulated event id failure");
          return "request-throwing-event";
        }
      })
    );
    await expect(
      throwingService.createAndEvaluate(
        tenantA,
        baseInput,
        "create-throwing-event-id"
      )
    ).rejects.toThrow("ServiceFlow audit event generation failed");
    expect(await throwingService.listRequests(tenantA)).toEqual([]);
    expect(await throwingService.listAudit(tenantA)).toEqual([]);
  });

  it("does not mutate an existing request when re-evaluation audit staging fails", async () => {
    let tick = 0;
    const service = new ServiceFlowService(
      new InMemoryServiceFlowRepository({
        now: () => new Date(1_780_000_000_000 + tick++),
        id: sequenceId([
          "request-re-evaluate",
          "event-original-1",
          "event-original-2",
          "event-original-1"
        ])
      })
    );
    const created = await service.createAndEvaluate(
      tenantA,
      baseInput,
      "create-re-evaluate-atomic"
    );
    const auditBefore = await service.listAudit(tenantA);

    await expect(
      service.reEvaluate(tenantA, created.request.id)
    ).rejects.toThrow("ServiceFlow audit event id collision");

    expect(await service.getRequest(tenantA, created.request.id)).toEqual(
      created.request
    );
    expect(await service.listAudit(tenantA)).toEqual(auditBefore);
  });

  it("rejects PII-shaped fields and returns defensive clones isolated by tenant", async () => {
    const service = createService();
    await expect(
      service.createAndEvaluate(
        tenantA,
        {
          ...baseInput,
          customerEmail: "person@example.com"
        } as ServiceRequestInput,
        "create-0011"
      )
    ).rejects.toThrow(/Unrecognized key|customerEmail/i);

    const created = await service.createAndEvaluate(
      tenantA,
      baseInput,
      "create-0012"
    );
    created.request.state = "BLOCKED";

    expect((await service.getRequest(tenantA, created.request.id)).state).toBe(
      "REVIEW"
    );
    expect(await service.listRequests(tenantB)).toEqual([]);
  });
});

function technician(
  id: string,
  availableHours: readonly number[],
  status: "ACTIVE" | "INACTIVE" = "ACTIVE",
  serviceArea = "DEMO_CENTRAL_ZONE"
): Technician {
  return {
    id,
    label: `${id} — DEMO SYNTHETIC`,
    synthetic: true,
    status,
    skills: ["PLUMBING_LEAK"],
    serviceAreas: [serviceArea],
    availableHours
  };
}

function sequenceId(values: string[]): () => string {
  return () => {
    const value = values.shift();
    if (!value) throw new Error("Unexpected generated id request");
    return value;
  };
}
