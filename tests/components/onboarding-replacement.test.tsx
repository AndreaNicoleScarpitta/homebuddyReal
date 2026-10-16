import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Onboarding from "@/pages/onboarding";
import { QuickGuidePanel } from "@/components/onboarding-tour";
import { useQuickGuide } from "@/lib/guidance";

const mock = vi.hoisted(() => ({ navigate: vi.fn(), getHome: vi.fn(), createHome: vi.fn(), getSystems: vi.fn(), getTasks: vi.fn(), createSystem: vi.fn() }));
vi.mock("wouter", () => ({ useLocation: () => ["/onboarding", mock.navigate] }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: { id: "owner-a" }, isAuthenticated: true }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/components/field-tooltip", () => ({ FieldTooltip: () => null }));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn(), trackSlugPageView: vi.fn() }));
vi.mock("@/lib/api", () => mock);

let client: QueryClient;
let persisted: any;
function mount(element: React.ReactNode) {
  return render(<QueryClientProvider client={client}>{element}</QueryClientProvider>);
}
beforeEach(() => {
  vi.clearAllMocks(); sessionStorage.clear(); localStorage.clear(); window.history.replaceState(null, "", "/"); persisted = null;
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  mock.getHome.mockResolvedValue(null); mock.createHome.mockResolvedValue({ id: "home-a", zipCode: "99208" });
  mock.getSystems.mockResolvedValue([]); mock.getTasks.mockResolvedValue([]);
  vi.stubGlobal("fetch", vi.fn(async (_url, options) => {
    if (options?.method === "PUT") persisted = JSON.parse(options.body);
    return { ok: true, json: async () => persisted };
  }));
});
async function reachSystems() {
  await screen.findByTestId("input-zip");
  fireEvent.change(screen.getByTestId("input-zip"), { target: { value: "99208" } });
  fireEvent.click(screen.getByTestId("button-continue"));
}
describe("replacement home setup", () => {
  it("saves ZIP only, skips systems, and opens real Plan with zero tasks", async () => {
    mount(<Onboarding/>); await reachSystems();
    expect(screen.getByTestId("chip-system-hvac")).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(screen.getByText("Do this later"));
    await waitFor(() => expect(mock.navigate).toHaveBeenCalledWith("/maintenance-log?guide=new"));
    expect(mock.createHome).toHaveBeenCalledWith(expect.objectContaining({ zipCode: "99208", builtYear: undefined, sqFt: undefined }));
    expect(mock.createSystem).not.toHaveBeenCalled();
    expect(persisted.status).toBe("active");
  });
  it("never reports success when home creation fails; keeps inputs retryable", async () => {
    mock.createHome.mockRejectedValue(new Error("Network unavailable"));
    mount(<Onboarding/>); await reachSystems(); fireEvent.click(screen.getByText("Do this later"));
    await screen.findByTestId("onboarding-error");
    expect(mock.navigate).not.toHaveBeenCalled();
    expect(screen.getByText("Do this later")).toBeEnabled();
  });
  it("retries only failed systems after a partial save", async () => {
    mock.createSystem.mockImplementation(async (_home, system) => { if (system.category === "Plumbing" && mock.createSystem.mock.calls.length === 2) throw new Error("Temporary failure"); return { id: system.category }; });
    mock.getSystems.mockResolvedValue([{ category: "HVAC", source: "onboarding-quickpick" }, { category: "Plumbing", source: "onboarding-quickpick" }]);
    mount(<Onboarding/>); await reachSystems();
    fireEvent.click(screen.getByTestId("chip-system-hvac")); fireEvent.click(screen.getByTestId("chip-system-plumbing"));
    fireEvent.click(screen.getByTestId("button-generate-plan")); await screen.findByTestId("onboarding-systems-error");
    expect(mock.navigate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("button-generate-plan"));
    await waitFor(() => expect(mock.navigate).toHaveBeenCalledWith("/maintenance-log?guide=new"));
    expect(mock.createSystem.mock.calls.map(call => call[1].category)).toEqual(["HVAC", "Plumbing", "Plumbing"]);
    expect(mock.createHome).toHaveBeenCalledTimes(1);
  });
  it("an existing home bypasses setup", async () => {
    mock.getHome.mockResolvedValue({ id: "saved-home" }); mount(<Onboarding/>);
    await waitFor(() => expect(mock.navigate).toHaveBeenCalledWith("/maintenance-log"));
    expect(mock.createHome).not.toHaveBeenCalled();
  });
  it("a failed home request never masquerades as no home", async () => {
    mock.getHome.mockRejectedValue(new Error("Offline")); mount(<Onboarding/>);
    await screen.findByRole("alert"); expect(screen.queryByTestId("input-zip")).not.toBeInTheDocument();
  });
});
function Guide({ tasks = true, task = null }: { tasks?: boolean; task?: string | null }) {
  const guide = useQuickGuide(true, tasks, task);
  return <><span data-testid="status">{guide.state?.status}</span>{!guide.open && <button onClick={guide.start}>Continue</button>}{guide.open && <QuickGuidePanel moment={guide.state!.moment} onNext={guide.next} onDismiss={guide.dismiss} onUpload={guide.finish}/>}</>;
}
describe("contextual education", () => {
  it("skips the task-details moment for an empty Plan", async () => {
    window.history.replaceState(null, "", "/maintenance-log?guide=new"); mount(<Guide tasks={false}/>);
    await screen.findByTestId("quick-guide-1"); fireEvent.click(screen.getByText("Got it"));
    await screen.findByTestId("quick-guide-3"); expect(screen.queryByTestId("quick-guide-2")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Done")); await waitFor(() => expect(persisted.status).toBe("completed"));
    expect(mock.createHome).not.toHaveBeenCalled();
  });
  it("Escape dismisses the whole guide without navigation", async () => {
    window.history.replaceState(null, "", "/maintenance-log?guide=new"); mount(<Guide/>);
    await screen.findByTestId("quick-guide-1"); fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(persisted.status).toBe("dismissed"));
    expect(screen.queryByTestId("quick-guide-1")).not.toBeInTheDocument(); expect(mock.navigate).not.toHaveBeenCalled();
  });
  it("interrupted guidance offers continuation without reopening", async () => {
    persisted = { version: 1, status: "active", moment: 2 }; mount(<Guide/>);
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("suspended"));
    expect(screen.queryByTestId("quick-guide-2")).not.toBeInTheDocument(); fireEvent.click(screen.getByText("Continue"));
    await screen.findByTestId("quick-guide-2");
  });
  it("persists a session dismissal when preference storage is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    window.history.replaceState(null, "", "/maintenance-log?guide=replay"); const view = mount(<Guide/>);
    await screen.findByTestId("quick-guide-1"); fireEvent.click(screen.getByText("Skip guide"));
    await waitFor(() => expect(JSON.parse(sessionStorage.getItem("homebuddy:guidance:owner-a")!).status).toBe("dismissed"));
    view.unmount(); mount(<Guide/>); await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("dismissed"));
    expect(screen.queryByTestId("quick-guide-1")).not.toBeInTheDocument();
  });
});
