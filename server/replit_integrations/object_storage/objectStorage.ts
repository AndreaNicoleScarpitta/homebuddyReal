/**
 * R2-backed object storage (Cloudflare R2 via S3 SDK).
 *
 * Replaces the previous GCS + Replit-sidecar implementation. Same class API
 * so existing call sites mostly don't change — the main differences:
 *
 *   - Returns lightweight `ObjectRef` handles (`{ key }`) instead of GCS File objects.
 *   - `objectStorageClient` is the raw S3Client; legacy `.bucket(x).file(y)` calls
 *     must be updated (see routes_v2.ts and reportAnalyzer.ts).
 *   - ACL lives in the `object_acl` DB table (see objectAcl.ts).
 */

import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Response } from "express";
import { randomUUID } from "crypto";
import { Readable } from "stream";
import {
  ObjectAclPolicy,
  ObjectPermission,
  ObjectRef,
  canAccessObject,
  getObjectAclPolicy,
  setObjectAclPolicy,
} from "./objectAcl";

const R2_ENDPOINT = process.env.R2_ENDPOINT || "";
const R2_BUCKET = process.env.R2_BUCKET || "";
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || "";
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || "";
const R2_PUBLIC_BASE_URL = (process.env.R2_PUBLIC_BASE_URL || "").replace(/\/$/, "");

if (process.env.NODE_ENV === "production" && (!R2_ENDPOINT || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET)) {
  console.warn("[object-storage] R2 env vars missing — file uploads will fail until configured");
}

export const objectStorageClient = new S3Client({
  region: "auto",
  endpoint: R2_ENDPOINT || undefined,
  credentials: R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY
    ? { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY }
    : undefined,
  forcePathStyle: false,
});

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export class ObjectStorageService {
  constructor() {}

  getBucket(): string {
    if (!R2_BUCKET) throw new Error("R2_BUCKET not set");
    return R2_BUCKET;
  }

  /** Returns key prefixes where "public" objects live (e.g. ["public/"]). */
  getPublicObjectSearchPaths(): string[] {
    const raw = process.env.PUBLIC_OBJECT_SEARCH_PATHS || "public";
    return Array.from(new Set(raw.split(",").map((p) => p.trim().replace(/^\/+|\/+$/g, "")).filter(Boolean)));
  }

  /** Returns the key prefix for private/user-owned uploads (default "uploads"). */
  getPrivateObjectDir(): string {
    return (process.env.PRIVATE_OBJECT_DIR || "uploads").replace(/^\/+|\/+$/g, "");
  }

  /** Search for a public object by filename under any known public prefix. */
  async searchPublicObject(filePath: string): Promise<ObjectRef | null> {
    for (const prefix of this.getPublicObjectSearchPaths()) {
      const key = `${prefix}/${filePath}`.replace(/^\/+/, "");
      if (await this.objectExists(key)) return { key };
    }
    return null;
  }

  async objectExists(key: string): Promise<boolean> {
    try {
      await objectStorageClient.send(new HeadObjectCommand({ Bucket: this.getBucket(), Key: key }));
      return true;
    } catch (err: any) {
      if (err?.$metadata?.httpStatusCode === 404 || err?.name === "NotFound" || err?.Code === "NoSuchKey") return false;
      throw err;
    }
  }

  async getMetadata(key: string) {
    return objectStorageClient.send(new HeadObjectCommand({ Bucket: this.getBucket(), Key: key }));
  }

  /** Stream an object to an Express response with proper headers and Cache-Control. */
  async downloadObject(object: ObjectRef, res: Response, cacheTtlSec = 3600) {
    try {
      const head = await this.getMetadata(object.key);
      const policy = await getObjectAclPolicy(object);
      const isPublic = policy?.visibility === "public";

      res.set({
        "Content-Type": head.ContentType || "application/octet-stream",
        "Content-Length": head.ContentLength ? String(head.ContentLength) : undefined as any,
        "Cache-Control": `${isPublic ? "public" : "private"}, max-age=${cacheTtlSec}`,
      });

      const resp = await objectStorageClient.send(
        new GetObjectCommand({ Bucket: this.getBucket(), Key: object.key }),
      );
      const body = resp.Body;
      if (!body) {
        if (!res.headersSent) res.status(500).json({ error: "Empty body" });
        return;
      }
      if (body instanceof Readable) {
        body.on("error", (err) => {
          console.error("Stream error:", err);
          if (!res.headersSent) res.status(500).json({ error: "Error streaming file" });
        });
        body.pipe(res);
      } else {
        // @aws-sdk/client-s3 in Node returns a Readable; fall back just in case
        const buf = Buffer.from(await (body as any).transformToByteArray());
        res.end(buf);
      }
    } catch (err: any) {
      console.error("Error downloading file:", err);
      if (!res.headersSent) {
        if (err?.name === "NotFound" || err?.$metadata?.httpStatusCode === 404) {
          res.status(404).json({ error: "Not found" });
        } else {
          res.status(500).json({ error: "Error downloading file" });
        }
      }
    }
  }

  /** Presigned PUT URL for direct browser uploads to R2. */
  async getObjectEntityUploadURL(): Promise<string> {
    const privateDir = this.getPrivateObjectDir();
    const objectId = randomUUID();
    const key = `${privateDir}/${objectId}`;
    return getSignedUrl(
      objectStorageClient,
      new PutObjectCommand({ Bucket: this.getBucket(), Key: key }),
      { expiresIn: 900 },
    );
  }

  /** Resolve /objects/<entityId> → ObjectRef{key} and verify it exists. */
  async getObjectEntityFile(objectPath: string): Promise<ObjectRef> {
    if (!objectPath.startsWith("/objects/")) throw new ObjectNotFoundError();
    const entityId = objectPath.slice("/objects/".length);
    if (!entityId) throw new ObjectNotFoundError();

    const privateDir = this.getPrivateObjectDir();
    const key = `${privateDir}/${entityId}`.replace(/^\/+/, "");

    if (!(await this.objectExists(key))) throw new ObjectNotFoundError();
    return { key };
  }

  /** Map any app-internal reference (path or presigned URL) to /objects/<entityId>. */
  normalizeObjectEntityPath(rawPath: string): string {
    // Handle presigned R2 URLs from getObjectEntityUploadURL.
    try {
      const u = new URL(rawPath);
      const endpoint = new URL(R2_ENDPOINT || "http://localhost");
      if (u.hostname === endpoint.hostname || u.hostname.endsWith(".r2.cloudflarestorage.com")) {
        // Pathname is /<bucket>/<key> or /<key>
        const segments = u.pathname.split("/").filter(Boolean);
        // If the first segment is the bucket, drop it
        if (segments[0] === this.getBucket()) segments.shift();
        const key = segments.join("/");
        const privateDir = this.getPrivateObjectDir();
        if (key.startsWith(privateDir + "/")) {
          return `/objects/${key.slice(privateDir.length + 1)}`;
        }
        return `/objects/${key}`;
      }
    } catch {
      // Not a URL — continue.
    }
    // Legacy gs:// or storage.googleapis.com URLs: best-effort passthrough
    if (rawPath.startsWith("https://storage.googleapis.com/")) {
      try {
        const u = new URL(rawPath);
        return `/objects/${u.pathname.split("/").filter(Boolean).slice(1).join("/")}`;
      } catch { /* fallthrough */ }
    }
    return rawPath;
  }

  async trySetObjectEntityAclPolicy(rawPath: string, aclPolicy: ObjectAclPolicy): Promise<string> {
    const normalized = this.normalizeObjectEntityPath(rawPath);
    if (!normalized.startsWith("/")) return normalized;
    const objectFile = await this.getObjectEntityFile(normalized);
    await setObjectAclPolicy(objectFile, aclPolicy);
    return normalized;
  }

  async canAccessObjectEntity({
    userId,
    objectFile,
    requestedPermission,
  }: {
    userId?: string;
    objectFile: ObjectRef;
    requestedPermission?: ObjectPermission;
  }): Promise<boolean> {
    return canAccessObject({
      userId,
      objectFile,
      requestedPermission: requestedPermission ?? ObjectPermission.READ,
    });
  }

  async deleteObject(key: string): Promise<void> {
    await objectStorageClient.send(new DeleteObjectCommand({ Bucket: this.getBucket(), Key: key }));
  }

  /** Public URL for objects that should be browser-accessible (requires R2_PUBLIC_BASE_URL). */
  publicUrl(key: string): string | null {
    if (!R2_PUBLIC_BASE_URL) return null;
    return `${R2_PUBLIC_BASE_URL}/${encodeURI(key)}`;
  }
}
