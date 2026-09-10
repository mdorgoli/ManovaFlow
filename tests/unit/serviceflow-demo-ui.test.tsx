/* @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type {
  ServiceFlowCase,
  ServiceFlowSnapshot,
  ServiceRequestState
} from "@/modules/serviceflow";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("ServiceFlow clickable demo UI", () => {
  it.each(["POSSIBLE_EMERGENCY", "SAFETY_UNKNOWN"] as const)(
    "shows evaluated %s instead of a contradictory SAFE intake in every language",
    async (blockReason) => {
      const initial = snapshot("REVIEW");
      initial.cases[1]!.evaluation.blockReason = blockReason;
      await renderDemo(initial);

      expect(screen.getByText("SAFE")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: /Possible emergency/i }));
      for (const language of ["English", "Français", "العربية"]) {
        fireEvent.click(screen.getByRole("button", { name: language }));
        const details = document.querySelector("dl");
        expect(details).toHaveTextContent(blockReason);
        expect(screen.queryByText("SAFE")).not.toBeInTheDocument();
        expect(screen.queryByLabelText("Human reason")).not.toBeInTheDocument();
        expect(document.querySelector("article button[disabled]")).toBeInTheDocument();
      }
    }
  );

  it("shows two synthetic cases and keeps proposal visibly separate from assignment", async () => {
    await renderDemo(snapshot("REVIEW"));

    expect(screen.getByRole("heading", { level: 1, name: "ServiceFlow operations demo" })).toBeInTheDocument();
    expect(screen.getByText("DEMO · SYNTHETIC DATA · NO OUTBOUND")).toBeInTheDocument();
    expect(screen.getByText("Recommended technician")).toBeInTheDocument();
    expect(screen.getByText("Recommendation only — no assignment exists")).toBeInTheDocument();
    expect(screen.getByText("DEMO TECHNICIAN ALPHA — SYNTHETIC")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Possible emergency/i }));
    expect(screen.getByRole("heading", { level: 2, name: "Safety lock" })).toBeInTheDocument();
    expect(screen.getByText("This request cannot be assigned, started, completed, or closed.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Safety locked" })).toBeDisabled();
  });

  it("switches English, French, and Arabic with real RTL without fetching or resetting state", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await renderDemo(snapshot("ASSIGNED"));

    fireEvent.click(screen.getByRole("button", { name: "Français" }));
    expect(screen.getByRole("heading", { level: 1, name: "Démo des opérations ServiceFlow" })).toBeInTheDocument();
    expect(screen.getAllByText("Affectée").length).toBeGreaterThan(0);
    expect(screen.getByTestId("serviceflow-demo")).toHaveAttribute("dir", "ltr");

    fireEvent.click(screen.getByRole("button", { name: "العربية" }));
    expect(screen.getByRole("heading", { level: 1, name: "عرض عمليات ServiceFlow" })).toBeInTheDocument();
    expect(screen.getAllByText("تم التعيين").length).toBeGreaterThan(0);
    expect(screen.getByTestId("serviceflow-demo")).toHaveAttribute("dir", "rtl");
    expect(screen.getByTestId("serviceflow-demo")).toHaveAttribute("lang", "ar");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends approval without client identity and refreshes the assigned snapshot with same-origin CSRF", async () => {
    const assigned = snapshot("ASSIGNED");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ request: assigned.cases[0]!.request, outboundActionCount: 0 }))
      .mockResolvedValueOnce(jsonResponse(assigned));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(document, "cookie", "get").mockReturnValue(
      "__Host-manovaflow-csrf=csrf-demo-token-123"
    );
    await renderDemo(snapshot("REVIEW"));

    fireEvent.change(screen.getByLabelText("Human reason"), {
      target: { value: "DEMO: dispatcher verified scope and availability." }
    });
    fireEvent.click(screen.getByRole("button", { name: "Approve proposal" }));

    expect((await screen.findAllByText("Assigned")).length).toBeGreaterThan(0);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/serviceflow/requests/");
    expect(url).toContain("/commands");
    expect(init.credentials).toBe("same-origin");
    const headers = new Headers(init.headers);
    expect(headers.get("x-csrf-token")).toBe("csrf-demo-token-123");
    expect(headers.get("idempotency-key")).toMatch(/^serviceflow-ui-/);
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      action: "APPROVE",
      reason: "DEMO: dispatcher verified scope and availability."
    });
    expect(body).not.toHaveProperty("tenantId");
    expect(body).not.toHaveProperty("actorId");
    expect(body).not.toHaveProperty("role");
  });

  it.each([
    ["ASSIGNED", "Start work"],
    ["IN_PROGRESS", "Pause work"],
    ["BLOCKED", "Resume work"],
    ["COMPLETED", "Close request"]
  ] as const)("offers the valid next action for %s", async (state, action) => {
    await renderDemo(snapshot(state, state === "IN_PROGRESS"));
    expect(screen.getByRole("button", { name: action })).toBeInTheDocument();
    if (state === "IN_PROGRESS") {
      expect(screen.getByRole("button", { name: "Add demo evidence" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Complete request" })).toBeEnabled();
    }
  });

  it("runs reset twice, restores the baseline, and preserves the selected language", async () => {
    const baseline = snapshot("REVIEW");
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(baseline)));
    vi.stubGlobal("fetch", fetchMock);
    await renderDemo(snapshot("CLOSED", true));

    fireEvent.click(screen.getByRole("button", { name: "العربية" }));
    fireEvent.click(screen.getByRole("button", { name: "إعادة ضبط العرض" }));
    expect((await screen.findAllByText("قيد المراجعة")).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "إعادة ضبط العرض" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId("serviceflow-demo")).toHaveAttribute("dir", "rtl");
    expect(screen.getByRole("heading", { level: 1, name: "عرض عمليات ServiceFlow" })).toBeInTheDocument();
    expect(screen.getByText("تمت استعادة الحالة الأساسية الحتمية ذات الطلبين.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "English" }));
    expect(screen.getByText("The deterministic two-case demo baseline was restored.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const [, init] of fetchMock.mock.calls as [string, RequestInit][]) {
      expect(init.method).toBe("POST");
      expect(JSON.parse(String(init.body))).toEqual({});
    }
  });

  it("shows a safe retry state when the tenant snapshot cannot load", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          { error: { code: "DEMO_UNAVAILABLE", message: "internal details must not render" } },
          503
        )
      )
    );
    await renderDemo(null);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The ServiceFlow demo could not load. No workflow state was changed."
    );
    expect(screen.queryByText("internal details must not render")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});

async function renderDemo(initialSnapshot: ServiceFlowSnapshot | null) {
  const { ServiceFlowDemo } = await import("@/components/serviceflow-demo");
  return render(<ServiceFlowDemo initialSnapshot={initialSnapshot} />);
}

function snapshot(
  state: ServiceRequestState,
  withEvidence = false
): ServiceFlowSnapshot {
  const normal = normalCase(state, withEvidence);
  const hazard = hazardCase();
  return {
    cases: [normal, hazard],
    approvals:
      state === "REVIEW" || state === "BLOCKED"
        ? []
        : [
            {
              id: "DEMO_APPROVAL_001",
              tenantId: normal.request.tenantId,
              requestId: normal.request.id,
              requestRevision: 1,
              technicianId: "DEMO_TECHNICIAN_ALPHA",
              approvedBy: "20000000-0000-4000-8000-000000000001",
              approvedByRole: "OWNER",
              reason: "DEMO: approved for UI fixture.",
              createdAt: "2026-09-05T00:00:05.000Z"
            }
          ],
    assignments:
      state === "REVIEW" || state === "BLOCKED"
        ? []
        : [
            {
              id: "DEMO_ASSIGNMENT_001",
              tenantId: normal.request.tenantId,
              requestId: normal.request.id,
              technicianId: "DEMO_TECHNICIAN_ALPHA",
              approvalId: "DEMO_APPROVAL_001",
              assignedBy: "20000000-0000-4000-8000-000000000001",
              createdAt: "2026-09-05T00:00:06.000Z"
            }
          ],
    completionEvidence: withEvidence
      ? [
          {
            id: "DEMO_EVIDENCE_001",
            tenantId: normal.request.tenantId,
            requestId: normal.request.id,
            assignmentId: "DEMO_ASSIGNMENT_001",
            type: "DEMO_INTERNAL_FIXTURE",
            assetId: "DEMO_EVIDENCE_FIXTURE_COMPLETION_01",
            attachedBy: "20000000-0000-4000-8000-000000000001",
            createdAt: "2026-09-05T00:00:08.000Z"
          }
        ]
      : [],
    audit: [
      {
        id: "DEMO_EVENT_RESET",
        tenantId: normal.request.tenantId,
        sequence: 1,
        requestId: "DEMO_RESET",
        type: "DEMO_TENANT_RESET",
        actorId: "20000000-0000-4000-8000-000000000001",
        details: { synthetic: true },
        createdAt: "2026-09-05T00:00:00.000Z"
      }
    ],
    outboundActionCount: 0
  };
}

function normalCase(state: ServiceRequestState, withEvidence: boolean): ServiceFlowCase {
  const assigned = !["NEW", "NEEDS_INFO", "REVIEW"].includes(state);
  return {
    request: {
      id: "DEMO_REQUEST_STANDARD_001",
      tenantId: "10000000-0000-4000-8000-000000000001",
      state,
      revision: state === "REVIEW" ? 1 : 3,
      input: {
        synthetic: true,
        description: "DEMO: kitchen sink has a slow leak and no safety concerns.",
        address: "DEMO_CENTRAL_ZONE",
        service: "PLUMBING_LEAK",
        requestedHour: 10,
        safetyAssessment: "SAFE"
      },
      ownerId: assigned ? "20000000-0000-4000-8000-000000000001" : null,
      assigneeId: assigned ? "DEMO_TECHNICIAN_ALPHA" : null,
      assignmentId: assigned ? "DEMO_ASSIGNMENT_001" : null,
      operationalBlockReason:
        state === "BLOCKED" ? "DEMO: access is temporarily blocked." : null,
      completionEvidenceIds: withEvidence ? ["DEMO_EVIDENCE_001"] : [],
      createdAt: "2026-09-05T00:00:01.000Z",
      updatedAt: "2026-09-05T00:00:08.000Z"
    },
    evaluation: {
      policyVersion: "serviceflow-policy-v1",
      checks: {
        completeness: "PASS",
        service: "PASS",
        serviceArea: "PASS",
        supportedHours: "PASS",
        safety: "PASS"
      },
      missingFields: [],
      blockReason: null,
      proposal: {
        technicianId: "DEMO_TECHNICIAN_ALPHA",
        technicianLabel: "DEMO TECHNICIAN ALPHA — SYNTHETIC",
        requestedHour: 10,
        policyVersion: "serviceflow-policy-v1",
        ruleVersion: "assignee-proposal-v1",
        explanation: "Synthetic technician matches the fixed demo policy."
      }
    }
  };
}

function hazardCase(): ServiceFlowCase {
  return {
    request: {
      id: "DEMO_REQUEST_SAFETY_001",
      tenantId: "10000000-0000-4000-8000-000000000001",
      state: "BLOCKED",
      revision: 1,
      input: {
        synthetic: true,
        description: "DEMO: there is a gas leak and an immediate hazard.",
        address: "DEMO_CENTRAL_ZONE",
        service: "PLUMBING_LEAK",
        requestedHour: 10,
        safetyAssessment: "SAFE"
      },
      ownerId: null,
      assigneeId: null,
      assignmentId: null,
      operationalBlockReason: null,
      completionEvidenceIds: [],
      createdAt: "2026-09-05T00:00:03.000Z",
      updatedAt: "2026-09-05T00:00:03.000Z"
    },
    evaluation: {
      policyVersion: "serviceflow-policy-v1",
      checks: {
        completeness: "NOT_EVALUATED",
        service: "NOT_EVALUATED",
        serviceArea: "NOT_EVALUATED",
        supportedHours: "NOT_EVALUATED",
        safety: "FAIL"
      },
      missingFields: [],
      blockReason: "POSSIBLE_EMERGENCY",
      proposal: null
    }
  };
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" }
  });
}
