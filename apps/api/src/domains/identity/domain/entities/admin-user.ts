import type { AdminRole } from "@cloudcommerce/types";

export type AdminUser = {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  role: AdminRole;
  isActive: boolean;
  mfaEnabled: boolean;
  mfaSecretEnc: string | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};
