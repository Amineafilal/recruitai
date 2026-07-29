import { z } from "zod";
import { PlanId } from "./plan.js";

export const TenantSchema = z.object({
  id: z.string().uuid(),
  nom: z.string().min(1),
  plan: PlanId,
  createdAt: z.coerce.date(),
});
export type Tenant = z.infer<typeof TenantSchema>;

export const UserRole = z.enum(["admin", "recruteur"]);
export type UserRole = z.infer<typeof UserRole>;

export const UserSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  email: z.string().email(),
  role: UserRole,
  createdAt: z.coerce.date(),
});
export type User = z.infer<typeof UserSchema>;
