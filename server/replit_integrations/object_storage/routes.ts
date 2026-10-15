import type { Express } from "express";
import multer from "multer";
import { randomUUID } from "crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { ObjectStorageService, ObjectNotFoundError, objectStorageClient } from "./objectStorage";
import { isAuthenticated } from "../auth";
import { ObjectPermission, setObjectAclPolicy } from "./objectAcl";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

export function registerObjectStorageRoutes(app: Express): void {
  const objectStorageService = new ObjectStorageService();

  app.post("/api/uploads/upload", isAuthenticated, upload.single("file"), async (req, res) => {
    try {
      const file = req.file;
      if (!file) return res.status(400).json({ error: "No file provided" });

      const privateObjectDir = objectStorageService.getPrivateObjectDir();
      const objectId = randomUUID();
      const key = `${privateObjectDir}/${objectId}`;

      await objectStorageClient.send(new PutObjectCommand({
        Bucket: objectStorageService.getBucket(),
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype || "application/octet-stream",
      }));

      await setObjectAclPolicy({ key }, { owner: String((req as any).user.id), visibility: "private" });
      const objectPath = `/objects/${objectId}`;

      res.json({
        objectPath,
        metadata: {
          name: file.originalname,
          size: file.size,
          contentType: file.mimetype,
        },
      });
    } catch (error) {
      console.error("Error uploading file:", error);
      res.status(500).json({ error: "Failed to upload file" });
    }
  });

  app.post("/api/uploads/request-url", isAuthenticated, async (req, res) => {
    try {
      const { name, size, contentType } = req.body;

      if (typeof name !== "string" || !name.trim() || name.length > 255 || !Number.isSafeInteger(size) || size < 1 || size > 10 * 1024 * 1024 || typeof contentType !== "string" || contentType.length > 128) {
        return res.status(400).json({
          error: "A valid name, content type, and size (1–10485760 bytes) are required",
        });
      }

      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);
      if (!objectPath.startsWith("/objects/")) throw new Error("Unexpected upload object path");
      const key = `${objectStorageService.getPrivateObjectDir()}/${objectPath.slice("/objects/".length)}`;
      await setObjectAclPolicy({ key }, { owner: String((req as any).user.id), visibility: "private" });

      res.json({
        uploadURL,
        objectPath,
        metadata: { name, size, contentType },
      });
    } catch (error) {
      console.error("Error generating upload URL:", error);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });

  app.get("/objects/:objectPath(*)", async (req, res) => {
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      const userId = (req as any).session?.userId;
      const allowed = await objectStorageService.canAccessObjectEntity({
        userId: userId ? String(userId) : undefined,
        objectFile,
        requestedPermission: ObjectPermission.READ,
      });
      if (!allowed) return res.status(404).json({ error: "Object not found" });
      await objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error serving object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ error: "Object not found" });
      }
      return res.status(500).json({ error: "Failed to serve object" });
    }
  });
}
