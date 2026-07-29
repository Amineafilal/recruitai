/**
 * Sous-ensemble des payloads webhook Clerk qu'on exploite. Clerk envoie bien
 * plus de champs ; on ne type que ce dont on a besoin.
 */
export interface ClerkWebhookEvent {
  type: string;
  data: Record<string, unknown>;
}

export interface OrganizationData {
  id: string;
  name: string;
}

export interface OrganizationMembershipData {
  organization: { id: string };
  public_user_data: {
    user_id: string;
    identifier: string; // email
  };
  role: string; // "org:admin" | "org:member" | ...
}
