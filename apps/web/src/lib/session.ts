import { cookies } from "next/headers";

export const SESSION_COOKIE = "recruitai_session";
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export interface SessionUser {
  id: string;
  email: string;
  role: string;
  tenantId: string;
  agence: string;
}

export function getSessionToken(): string | undefined {
  return cookies().get(SESSION_COOKIE)?.value;
}

/** Récupère l'utilisateur courant depuis l'API (ou null si non connecté). */
export async function getSessionUser(): Promise<SessionUser | null> {
  const token = getSessionToken();
  if (!token) return null;
  try {
    const res = await fetch(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as SessionUser;
  } catch {
    return null;
  }
}
