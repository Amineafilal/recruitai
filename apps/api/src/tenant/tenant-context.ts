import type { UserRole } from "@recruitai/types";

export interface TenantContext {
  tenantId: string;
  userId: string;
  clerkUserId: string;
  role: UserRole;
}
