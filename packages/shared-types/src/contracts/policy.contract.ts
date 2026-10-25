import type { PolicyDocument } from '../domain/iam.js';

export interface PolicyResponse {
  /** `managed:<key>` for ready-made policies, otherwise a UUID. */
  id: string;
  name: string;
  description: string;
  managed: boolean;
  document: PolicyDocument;
  /** How many roles in the workspace use it. */
  attachedRoleCount: number;
}

export interface SavePolicyRequest {
  name: string;
  description?: string;
  document: PolicyDocument;
}

/** The caller's own access in a workspace, so clients can hide what they can't use. */
export interface MyAccessResponse {
  permissions: string[];
  readableFields: string[];
}
