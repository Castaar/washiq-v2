import type { SVGProps } from 'react';
import React from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

const base = (size = 18) => ({ width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const });

export function IconGrid({ size, ...p }: IconProps) {
  return <svg {...base(size)} {...p}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>;
}

export function IconBox({ size, ...p }: IconProps) {
  return <svg {...base(size)} {...p}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>;
}

export function IconCart({ size, ...p }: IconProps) {
  return <svg {...base(size)} {...p}><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>;
}

export function IconBarChart({ size, ...p }: IconProps) {
  return <svg {...base(size)} {...p}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>;
}

export function IconBell({ size, ...p }: IconProps) {
  return <svg {...base(size)} {...p}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>;
}

export function IconFileText({ size, ...p }: IconProps) {
  return <svg {...base(size)} {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>;
}

export function IconSettings({ size, ...p }: IconProps) {
  return <svg {...base(size)} {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>;
}

export function IconChevronLeft({ size, ...p }: IconProps) {
  return <svg {...base(size)} {...p}><polyline points="15 18 9 12 15 6"/></svg>;
}

export function IconChevronRight({ size, ...p }: IconProps) {
  return <svg {...base(size)} {...p}><polyline points="9 18 15 12 9 6"/></svg>;
}

export function IconChevronDown({ size, ...p }: IconProps) {
  return <svg {...base(size)} {...p}><polyline points="6 9 12 15 18 9"/></svg>;
}

export function IconMenu({ size, ...p }: IconProps) {
  return <svg {...base(size)} {...p}><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>;
}

export function IconX({ size, ...p }: IconProps) {
  return <svg {...base(size)} {...p}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
}

export function IconTrash({ size, ...p }: IconProps) {
  return <svg {...base(size)} {...p}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>;
}

export function IconSearch({ size, ...p }: IconProps) {
  return <svg {...base(size)} {...p}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
}

export function IconTrendingUp({ size, ...p }: IconProps) {
  return <svg {...base(size)} {...p}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>;
}

export function IconTrendingDown({ size, ...p }: IconProps) {
  return <svg {...base(size)} {...p}><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>;
}

export function IconAlertTriangle({ size, ...p }: IconProps) {
  return <svg {...base(size)} {...p}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
}

export function IconInfo({ size, ...p }: IconProps) {
  return <svg {...base(size)} {...p}><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>;
}

export function IconUser({ size, ...p }: IconProps) {
  return <svg {...base(size)} {...p}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
}

export function IconFilter({ size, ...p }: IconProps) {
  return <svg {...base(size)} {...p}><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>;
}

export function IconCalendar({ size, ...p }: IconProps) {
  return <svg {...base(size)} {...p}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
}

export function IconPackage({ size, ...p }: IconProps) {
  return <svg {...base(size)} {...p}><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>;
}

export function IconWrench({ size, ...p }: IconProps) {
  return <svg {...base(size)} {...p}><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>;
}

export function IconCheck({ size, ...p }: IconProps) {
  return <svg {...base(size)} {...p}><polyline points="20 6 9 17 4 12"/></svg>;
}

export function IconWarning({ size, ...p }: IconProps) {
  return <svg {...base(size)} {...p}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
}

export function IconClipboard({ size, ...p }: IconProps) {
  return <svg {...base(size)} {...p}><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>;
}

export function IconMessageSquare({ size, ...p }: IconProps) {
  return <svg {...base(size)} {...p}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
}

export function IconEye({ size, ...p }: IconProps) {
  return <svg {...base(size)} {...p}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
}

export function IconEyeOff({ size, ...p }: IconProps) {
  return <svg {...base(size)} {...p}><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>;
}

const iconMap: Record<string, (p: IconProps) => React.ReactElement> = {
  grid:             IconGrid,
  box:              IconBox,
  'shopping-cart':  IconCart,
  'bar-chart':      IconBarChart,
  bell:             IconBell,
  'file-text':      IconFileText,
  settings:         IconSettings,
  'alert-triangle': IconAlertTriangle,
  'trending-up':    IconTrendingUp,
  'trending-down':  IconTrendingDown,
  info:             IconInfo,
  search:           IconSearch,
  user:             IconUser,
  filter:           IconFilter,
  calendar:         IconCalendar,
  package:          IconPackage,
  wrench:           IconWrench,
  check:            IconCheck,
  warning:          IconWarning,
  clipboard:        IconClipboard,
  'message-square': IconMessageSquare,
  trash:            IconTrash,
};

export interface DynamicIconProps extends IconProps {
  name: string;
}

export function DynamicIcon({ name, ...rest }: DynamicIconProps) {
  const Icon = iconMap[name];
  if (!Icon) return null;
  return <Icon {...rest} />;
}

// Re-export ReactNode for convenience
export type { IconProps };
