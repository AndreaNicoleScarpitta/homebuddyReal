import React from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DocumentsSection } from "@/pages/documents";
const mock = vi.hoisted(() => ({ getHome: vi.fn(), getSystems: vi.fn(), getDocuments: vi.fn(), createDocument: vi.fn(), deleteDocument: vi.fn(), updateDocumentSystem: vi.fn(), toast: vi.fn() }));
vi.mock("@/lib/api", () => mock);
vi.mock("wouter", () => ({ useSearch: () => "", useLocation: () => ["/house", vi.fn()], Link: ({ children }: any) => <span>{children}</span> }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mock.toast }) }));
vi.mock("@/components/field-tooltip", () => ({ FieldTooltip: () => null }));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }));
vi.mock("@/components/ObjectUploader", () => ({ ObjectUploader: ({ onComplete, disabled }: any) => <button disabled={disabled} onClick={() => onComplete({ successful: [{ id: "object-a", name: "Warranty.pdf", type: "application/pdf", objectPath: "/objects/warranty" }] })}>Upload test document</button> }));
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><DocumentsSection/></QueryClientProvider>);
}
beforeEach(() => {
  vi.clearAllMocks(); vi.stubGlobal("React", React);
  mock.getHome.mockResolvedValue({ id: "home-a", legacyId: 12 });
  mock.getSystems.mockResolvedValue([]); mock.getDocuments.mockResolvedValue([]);
});
it("does not show an empty library when the document request failed", async () => {
  mock.getDocuments.mockRejectedValue(new Error("Offline")); mount();
  await screen.findByRole("alert"); expect(screen.queryByText("No documents yet")).not.toBeInTheDocument();
  expect(screen.getByText("Try again")).toBeInTheDocument();
});
it("reconciles a lost metadata response before retrying the saved object", async () => {
  const saved = { id: 1, name: "Warranty.pdf", objectPath: "/objects/warranty", fileType: "application/pdf", homeId: 12 };
  mock.createDocument.mockRejectedValue(new Error("Response lost")); mount();
  fireEvent.click(await screen.findByText("Upload test document"));
  await screen.findByText("Retry saving document");
  expect(mock.toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: "Document saved" }));
  expect(screen.getByText("Upload test document")).toBeDisabled();
  mock.getDocuments.mockResolvedValue([saved]);
  fireEvent.click(screen.getByText("Retry saving document"));
  await screen.findByTestId("card-document-1");
  expect(mock.createDocument).toHaveBeenCalledTimes(1);
  expect(mock.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Document saved" }));
  expect(screen.getByLabelText("View Warranty.pdf")).toBeInTheDocument();
});
it("a missing storage association is unavailable, never a setup prompt", async () => {
  mock.getHome.mockResolvedValue({ id: "home-a", legacyId: null }); mount();
  await screen.findByRole("alert"); expect(screen.queryByText(/set up your home profile/i)).not.toBeInTheDocument();
  expect(screen.queryByText("Upload test document")).not.toBeInTheDocument();
});
