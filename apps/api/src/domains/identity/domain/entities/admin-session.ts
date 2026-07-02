export type AdminSession = {
  id: string;
  adminUserId: string;
  refreshTokenHash: string;
  previousRefreshTokenHash: string | null;
  familyId: string;
  deviceLabel: string;
  deviceFingerprintHash: string | null;
  ip: string;
  userAgent: string;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export const isSessionActive = (session: AdminSession, now = new Date()): boolean =>
  session.revokedAt === null && session.expiresAt.getTime() > now.getTime();
