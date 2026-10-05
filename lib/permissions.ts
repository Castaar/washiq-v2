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
