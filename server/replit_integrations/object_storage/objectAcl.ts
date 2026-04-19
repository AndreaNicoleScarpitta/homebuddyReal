/**
 * Object ACL — DB-backed (works with R2/S3; no GCS metadata dependency).
 *
 * The previous Replit/GCS implementation stored ACL as custom object metadata.
 * R2/S3 don't allow mutating user metadata in place, so we persist ACL in
 * the `object_acl` table instead, keyed by the object key (e.g. "uploads/<uuid>").
 */

import { db } from "../../db";
import { objectAcl } from "@shared/models/auth";
import { eq } from "drizzle-orm";

// Kept for signature compatibility with legacy call sites.
export enum ObjectAccessGroupType {}

export interface ObjectAccessGroup {
  type: ObjectAccessGroupType;
  id: string;
}

export enum ObjectPermission {
  READ = "read",
  WRITE = "write",
}

export interface ObjectAclRule {
  group: ObjectAccessGroup;
  permission: ObjectPermission;
}

export interface ObjectAclPolicy {
  owner: string;
  visibility: "public" | "private";
  aclRules?: Array<ObjectAclRule>;
}

/** Lightweight handle for an object in R2 — replaces GCS File reference. */
export interface ObjectRef {
  key: string;
}

function isPermissionAllowed(requested: ObjectPermission, granted: ObjectPermission): boolean {
  if (requested === ObjectPermission.READ) {
    return [ObjectPermission.READ, ObjectPermission.WRITE].includes(granted);
  }
  return granted === ObjectPermission.WRITE;
}

abstract class BaseObjectAccessGroup implements ObjectAccessGroup {
  constructor(public readonly type: ObjectAccessGroupType, public readonly id: string) {}
  public abstract hasMember(userId: string): Promise<boolean>;
}

function createObjectAccessGroup(group: ObjectAccessGroup): BaseObjectAccessGroup {
  switch (group.type) {
    default:
      throw new Error(`Unknown access group type: ${group.type}`);
  }
}

export async function setObjectAclPolicy(object: ObjectRef, policy: ObjectAclPolicy): Promise<void> {
  await db
    .insert(objectAcl)
    .values({
      objectKey: object.key,
      ownerId: policy.owner,
      visibility: policy.visibility,
      rules: policy.aclRules ?? null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: objectAcl.objectKey,
      set: {
        ownerId: policy.owner,
        visibility: policy.visibility,
        rules: policy.aclRules ?? null,
        updatedAt: new Date(),
      },
    });
}

export async function getObjectAclPolicy(object: ObjectRef): Promise<ObjectAclPolicy | null> {
  const [row] = await db.select().from(objectAcl).where(eq(objectAcl.objectKey, object.key));
  if (!row) return null;
  return {
    owner: row.ownerId ?? "",
    visibility: (row.visibility as "public" | "private") ?? "private",
    aclRules: (row.rules as ObjectAclRule[]) ?? undefined,
  };
}

export async function canAccessObject({
  userId,
  objectFile,
  requestedPermission,
}: {
  userId?: string;
  objectFile: ObjectRef;
  requestedPermission: ObjectPermission;
}): Promise<boolean> {
  const policy = await getObjectAclPolicy(objectFile);
  if (!policy) return false;

  if (policy.visibility === "public" && requestedPermission === ObjectPermission.READ) return true;
  if (!userId) return false;
  if (policy.owner === userId) return true;

  for (const rule of policy.aclRules || []) {
    const g = createObjectAccessGroup(rule.group);
    if ((await g.hasMember(userId)) && isPermissionAllowed(requestedPermission, rule.permission)) {
      return true;
    }
  }
  return false;
}
