// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import HomePage from "@/app/(default)/page";

describe("public homepage", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("{}", { status: 503 }))
    );
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders the approved public story without requesting internal data", () => {
    render(<HomePage />);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Every request, clearly handled."
      })
    ).toBeVisible();
    expect(
      screen.getAllByText("Research preview · Human-controlled").length
    ).toBeGreaterThan(0);
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.queryByText("Growth Control")).not.toBeInTheDocument();
  });

  it("links every public anchor to a real section and keeps research tools separate", () => {
    const { container } = render(<HomePage />);
    const anchors = [
      ...container.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')
    ];
    expect(anchors.length).toBeGreaterThan(5);
    for (const anchor of anchors) {
      expect(
        document.getElementById(anchor.hash.slice(1)),
        anchor.textContent ?? "anchor"
      ).not.toBeNull();
    }
    expect(
      screen.getByRole("link", { name: "Open research dashboard" })
    ).toHaveAttribute("href", "/dashboard");
    expect(
      screen.getByRole("link", { name: "Explore the ServiceFlow demo" })
    ).toHaveAttribute("href", "/serviceflow");
  });

  it("shows five honest, ordered stages and the development status of all flows", () => {
    render(<HomePage />);
    const sequence = screen.getByRole("list", {
      name: "How a request moves through ManovaFlow"
    });
    expect(within(sequence).getAllByRole("listitem")).toHaveLength(5);
    expect(within(sequence).getByText("Human approval")).toBeVisible();
    expect(within(sequence).getByText("Proof of completion")).toBeVisible();
    expect(screen.getByText("In active development")).toBeVisible();
    expect(screen.getAllByText("In validation")).toHaveLength(2);
    expect(screen.queryByText(/^Active$/)).not.toBeInTheDocument();
  });

  it("opens an accessible mobile menu, traps focus, and restores focus on Escape", () => {
    render(<HomePage />);
    const trigger = screen.getByRole("button", { name: "Open menu" });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Navigation menu" });
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(document.body.style.overflow).toBe("hidden");
    const close = within(dialog).getByRole("button", { name: "Close menu" });
    const last = within(dialog).getByRole("link", { name: "Meet ServiceFlow" });
    close.focus();
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(last).toHaveFocus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(close).toHaveFocus();
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(document.body.style.overflow).toBe("");
  });

  it("closes the mobile menu after choosing a section and restores page scrolling", () => {
    render(<HomePage />);
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    const dialog = screen.getByRole("dialog", { name: "Navigation menu" });
    fireEvent.click(within(dialog).getByRole("link", { name: "Flows" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe("");
  });

  it("keeps the content usable if the decorative photograph fails", () => {
    const { container } = render(<HomePage />);
    const photo = container.querySelector<HTMLImageElement>(
      "img[data-home-photo]"
    );
    expect(photo).not.toBeNull();
    fireEvent.error(photo!);
    expect(container.querySelector("img[data-home-photo]")).toBeNull();
    expect(screen.getByRole("heading", { level: 1 })).toBeVisible();
    expect(
      screen.getByRole("list", {
        name: "How a request moves through ManovaFlow"
      })
    ).toBeVisible();
  });
});
