interface SessionLike {
  userId?: string;
  role?: string;
}

export function isManager(session: SessionLike | null | undefined): boolean {
  return session?.role === 'owner' || session?.role === 'developer';
}

// A record may be corrected or removed by a manager, or by whoever entered it.
export function canModify(session: SessionLike | null | undefined, ownerId: unknown): boolean {
  if (!session) return false;
  if (isManager(session)) return true;
  return Boolean(ownerId && session.userId && String(ownerId) === String(session.userId));
}

// Site-scoped manager access: developers everywhere, owners only on their own sites.
export function canManageSite(
  session: (SessionLike & { siteIds?: string[] }) | null | undefined,
  siteId: string,
): boolean {
  if (!session) return false;
  if (session.role === 'developer') return true;
  return session.role === 'owner' && (session.siteIds ?? []).includes(siteId);
}
