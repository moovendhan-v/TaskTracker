import type { PlatformRole } from '@taskflow/shared-types';

export interface User {
  id: string;
  name: string;
  email: string;
  image: string | null;
  platformRole: PlatformRole;
  suspended: boolean;
  emailVerified: boolean;
  createdAt: Date;
}
