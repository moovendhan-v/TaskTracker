import type { PlatformRole } from '../domain/permissions.js';

export interface CurrentUserResponse {
  id: string;
  name: string;
  email: string;
  image: string | null;
  platformRole: PlatformRole;
  /** Teammates can only add you to a workspace once this is true. */
  emailVerified: boolean;
}
