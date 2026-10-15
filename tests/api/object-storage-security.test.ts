import { describe, expect, it, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

const mocks = vi.hoisted(() => ({
  exists: vi.fn(), access: vi.fn(), download: vi.fn(),
  sign: vi.fn(), normalize: vi.fn(), acl: vi.fn(), put: vi.fn(),
}));
vi.mock("../../server/replit_integrations/auth", () => ({
  isAuthenticated: (req: any, res: any, next: any) =>
    req.headers["x-test-identity"]
      ? ((req.user = { id: req.headers["x-test-identity"] }), (req.session = { userId: req.headers["x-test-identity"] }), next())
      : res.status(401).json({ error: "Unauthorized" }),
}));
vi.mock("../../server/replit_integrations/object_storage/objectAcl", () => ({
  ObjectPermission: { READ: "read" },
  setObjectAclPolicy: mocks.acl,
}));
vi.mock("../../server/replit_integrations/object_storage/objectStorage", () => ({
  ObjectNotFoundError: class extends Error {},
  objectStorageClient: { send: mocks.put },
  ObjectStorageService: class {
    getPrivateObjectDir() { return "uploads"; }
    getBucket() { return "home-buddy"; }
    getObjectEntityFile() { return mocks.exists(); }
    canAccessObjectEntity(args: unknown) { return mocks.access(args); }
    downloadObject() { return mocks.download(); }
    getObjectEntityUploadURL() { return mocks.sign(); }
    normalizeObjectEntityPath() { return mocks.normalize(); }
  },
}));
import { registerObjectStorageRoutes } from "../../server/replit_integrations/object_storage/routes";

function app() {
  const a = express();
  a.use(express.json());
  // Simulate a session established by setupAuth for GET object requests.
  a.use((req: any, _res, next) => {
    if (req.headers["x-test-identity"]) req.session = { userId: req.headers["x-test-identity"] };
    next();
  });
  registerObjectStorageRoutes(a);
  return a;
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.exists.mockResolvedValue({ key: "uploads/known" });
  mocks.download.mockImplementation(async () => {});
  mocks.sign.mockResolvedValue("https://example.com/presigned");
  mocks.normalize.mockReturnValue("/objects/known");
  mocks.acl.mockResolvedValue(undefined);
});
describe("object access boundaries", () => {
  it("refuses anonymous private downloads", async () => {
    mocks.access.mockResolvedValue(false);
    const res = await request(app()).get("/objects/known");
    expect(res.status).toBe(404);
    expect(mocks.download).not.toHaveBeenCalled();
  });
  it("refuses a signed-in user without permission", async () => {
    mocks.access.mockResolvedValue(false);
    const res = await request(app()).get("/objects/known").set("x-test-identity", "other-user");
    expect(res.status).toBe(404);
    expect(mocks.download).not.toHaveBeenCalled();
    expect(mocks.access).toHaveBeenCalledWith(expect.objectContaining({ userId: "other-user", requestedPermission: "read" }));
  });
  it("issues no upload URL to anonymous callers", async () => {
    const res = await request(app()).post("/api/uploads/request-url").send({ name: "file.pdf", size: 10, contentType: "application/pdf" });
    expect(res.status).toBe(401);
    expect(mocks.sign).not.toHaveBeenCalled();
  });
  it("rejects invalid upload sizes", async () => {
    const res = await request(app()).post("/api/uploads/request-url").set("x-test-identity", "owner").send({ name: "file.pdf", size: 10485761, contentType: "application/pdf" });
    expect(res.status).toBe(400);
    expect(mocks.sign).not.toHaveBeenCalled();
  });
  it("records ownership before providing upload capability", async () => {
    const res = await request(app()).post("/api/uploads/request-url").set("x-test-identity", "owner").send({ name: "file.pdf", size: 10, contentType: "application/pdf" });
    expect(res.status).toBe(200);
    expect(mocks.acl).toHaveBeenCalledWith({ key: "uploads/known" }, { owner: "owner", visibility: "private" });
  });
});
