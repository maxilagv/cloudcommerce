import type { AdminProfile, Permission } from "@cloudcommerce/types";
import type { ListedSession } from "../application/services/identity-service.js";

export type MeResponse = {
  profile: AdminProfile;
  permissions: Permission[];
};

export const presentMe = (profile: AdminProfile, permissions: Permission[]): MeResponse => ({
  profile,
  permissions,
});

export const presentSessions = (sessions: ListedSession[]) => sessions;
