import { DashboardSkeleton } from '@/components/ui/Skeleton/Skeleton';

// Shown instantly on navigation while the page's server data loads. The root
// segment is the dashboard; other pages have their own loading.tsx (PageSkeleton).
export default function Loading() {
  return <DashboardSkeleton />;
}
