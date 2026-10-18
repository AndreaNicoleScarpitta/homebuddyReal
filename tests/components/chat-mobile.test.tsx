import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Chat from "@/pages/chat";
import { TooltipProvider } from "@/components/ui/tooltip";

const mocks = vi.hoisted(() => ({
  getHome: vi.fn(),
  getChatSessions: vi.fn(),
  createChatSession: vi.fn(),
  getChatSession: vi.fn(),
  updateChatSessionTitle: vi.fn(),
}));

vi.mock("@/lib/api", () => mocks);
vi.mock("@/components/layout", () => ({
  Layout: ({ children, immersive }: { children: React.ReactNode; immersive?: boolean }) =>
    <div data-testid="app-layout" data-immersive={immersive ? "true" : "false"}>{children}</div>,
}));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => true }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/components/photo-consent-modal", () => ({
  PhotoConsentModal: () => null,
  usePhotoConsent: () => ({ hasConsented: true, isLoaded: true, grantConsent: vi.fn() }),
}));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn(), trackSlugPageView: vi.fn() }));
vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}));

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><TooltipProvider><Chat /></TooltipProvider></QueryClientProvider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  Element.prototype.scrollIntoView = vi.fn();
  mocks.getHome.mockResolvedValue({ id: "home-test" });
  mocks.getChatSessions.mockResolvedValue([]);
  mocks.createChatSession.mockResolvedValue({ sessionId: "session-test" });
  mocks.updateChatSessionTitle.mockResolvedValue(undefined);
  const chunks = [
    { done: false, value: new TextEncoder().encode('data: {"content":"Check your due maintenance tasks."}\n') },
    { done: false, value: new TextEncoder().encode('data: {"done":true}\n') },
    { done: true, value: undefined },
  ];
  vi.stubGlobal("fetch", vi.fn(async () => ({
    ok: true,
    body: { getReader: () => ({ read: vi.fn().mockResolvedValueOnce(chunks[0]).mockResolvedValueOnce(chunks[1]).mockResolvedValueOnce(chunks[2]) }) },
  })));
});

describe("Home Assistant mobile experience", () => {
  it("uses immersive layout and keeps the composer separate from suggested questions", async () => {
    mount();
    expect(await screen.findByTestId("chat-empty-state")).toBeInTheDocument();
    expect(screen.getByTestId("app-layout")).toHaveAttribute("data-immersive", "true");
    expect(screen.getByRole("heading", { name: "Home Assistant" })).toBeInTheDocument();
    expect(screen.getByTestId("chat-composer")).toBeInTheDocument();
    expect(screen.getByTestId("chat-composer")).not.toContainElement(screen.getByTestId("chat-empty-state"));
    expect(screen.getByTestId("input-message")).toHaveAttribute("placeholder", "Ask about your home...");
    expect(screen.getByTestId("button-add-photo")).toBeEnabled();
    expect(screen.getByTestId("button-send")).toBeDisabled();
  });

  it("submits a suggested question immediately using the existing chat endpoint", async () => {
    mount();
    fireEvent.click(await screen.findByTestId("button-suggestion-prioritize"));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const [url, request] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("/v2/homes/home-test/chat");
    expect(JSON.parse(String(request?.body))).toMatchObject({
      sessionId: "session-test",
      content: "What maintenance tasks should I prioritize for my home?",
    });
    expect(await screen.findByText("Check your due maintenance tasks.")).toBeInTheDocument();
  });

  it("preserves typed chat entry and permits dismissing the safety notice", async () => {
    mount();
    expect(await screen.findByTestId("chat-safety-notice")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss informational notice" }));
    expect(screen.queryByTestId("chat-safety-notice")).not.toBeInTheDocument();
    fireEvent.change(screen.getByTestId("input-message"), { target: { value: "My faucet is dripping" } });
    expect(screen.getByTestId("button-send")).toBeEnabled();
    fireEvent.click(screen.getByTestId("button-send"));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const [, request] = vi.mocked(fetch).mock.calls[0];
    expect(JSON.parse(String(request?.body)).content).toBe("My faucet is dripping");
  });
});
