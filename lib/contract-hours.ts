import type { Types } from 'mongoose';
import { AttendanceLog, User } from '@/lib/models';
import { buildSessions, floorQuarter } from '@/lib/attendance-hours';
import { brusselsInstant } from '@/lib/dates';

// Worked hours this month vs. the monthly contract of each employee. Hours count
// over every carwash; anything above the contract is overtime.

export interface ContractStatus {
  userId: string;
  name: string;
  contractHours: number;
  workedHours: number;
  overtime: number; // 0 until the contract is reached
  reached: boolean;
}

export function brusselsMonth(at: Date = new Date()): { year: number; month: number; key: string } {
  const [y, m] = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Brussels', year: 'numeric', month: '2-digit' }).format(at).split('-').map(Number);
  return { year: y, month: m, key: `${y}-${String(m).padStart(2, '0')}` };
}

export function monthRange(year: number, month: number): { from: Date; to: Date } {
  const pad = (n: number) => String(n).padStart(2, '0');
  const next = month === 12 ? `${year + 1}-01-01` : `${year}-${pad(month + 1)}-01`;
  return { from: brusselsInstant(`${year}-${pad(month)}-01`, '00:00:00'), to: brusselsInstant(next, '00:00:00') };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// Worked hours per user (own registrations, not jobstudents/externals) in the month
export async function workedHoursForUsers(userIds: string[], year: number, month: number): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (userIds.length === 0) return result;
  const { from, to } = monthRange(year, month);
  const logs = await AttendanceLog.find({
    user_id: { $in: userIds },
    timestamp: { $gte: from, $lt: to },
    person_type: { $nin: ['technician_extern', 'jobstudent'] },
  }).select('user_id site_id timestamp type').lean();
  const byUser = new Map<string, typeof logs>();
  for (const l of logs) {
    const id = String(l.user_id);
    if (!byUser.has(id)) byUser.set(id, []);
    byUser.get(id)!.push(l);
  }
  for (const id of userIds) {
    result.set(id, round2(buildSessions(byUser.get(id) ?? []).reduce((sum, s) => sum + s.hours, 0)));
  }
  return result;
}

export function toStatus(userId: string, name: string, contractHours: number, workedHours: number): ContractStatus {
  return {
    userId,
    name,
    contractHours,
    workedHours,
    overtime: floorQuarter(Math.max(0, workedHours - contractHours)),
    reached: workedHours >= contractHours,
  };
}

// Status for every active employee/technician with a contract (optionally only some users)
export async function contractStatuses(year: number, month: number, onlyUserIds?: string[]): Promise<ContractStatus[]> {
  const users = await User.find({
    is_active: true,
    is_demo: { $ne: true },
    role: { $in: ['employee', 'technician'] },
    contract_hours: { $gt: 0 },
    ...(onlyUserIds ? { _id: { $in: onlyUserIds } } : {}),
  }).select('_id name contract_hours').lean();
  const ids = users.map((u) => String(u._id as Types.ObjectId));
  const worked = await workedHoursForUsers(ids, year, month);
  return users
    .map((u) => toStatus(String(u._id), (u.name as string) ?? '', u.contract_hours as number, worked.get(String(u._id)) ?? 0))
    .sort((a, b) => a.name.localeCompare(b.name));
}
