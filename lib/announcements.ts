import type { Types } from 'mongoose';
import { Planning, User } from '@/lib/models';

// Employees are linked to every filiaal (they rotate), so a message for one
// filiaal goes to whoever is planned there from `from` through the next 7 days.
export const RECIPIENT_WINDOW_DAYS = 8;

// Planning dates are stored as UTC midnight of the (Brussels) day
export function brusselsDayStart(at: Date = new Date()): Date {
  const dayStr = at.toLocaleString('sv-SE', { timeZone: 'Europe/Brussels' }).slice(0, 10);
  return new Date(`${dayStr}T00:00:00Z`);
}

export async function plannedRecipientIds(siteId: string, from: Date = new Date()): Promise<Types.ObjectId[]> {
  const start = brusselsDayStart(from);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + RECIPIENT_WINDOW_DAYS);
  const userIds = await Planning.distinct('user_id', { site_id: siteId, date: { $gte: start, $lt: end } });
  if (userIds.length === 0) return [];
  const users = await User.find({ _id: { $in: userIds }, is_active: true }).select('_id').lean();
  return users.map((u) => u._id as Types.ObjectId);
}

// Owners/developers see every message of the filiaal they're viewing; everyone
// else sees messages for all filialen plus the per-filiaal ones addressed to them.
export function announcementFilter(role: string | undefined, userId: string | undefined, siteId: string | null | undefined) {
  if (role === 'owner' || role === 'developer') {
    return siteId ? { $or: [{ is_all_sites: true }, { site_ids: siteId }] } : { is_all_sites: true };
  }
  return userId ? { $or: [{ is_all_sites: true }, { recipient_ids: userId }] } : { is_all_sites: true };
}
