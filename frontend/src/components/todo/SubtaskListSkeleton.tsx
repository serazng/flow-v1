import { Skeleton } from '@/components/ui/skeleton';

export default function SubtaskListSkeleton() {
  return (
    <>
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-4 flex-1" />
          </div>
        ))}
      </div>

      <div className="flex gap-2 pt-2 border-t">
        <Skeleton className="h-8 flex-1" />
        <Skeleton className="h-8 w-16" />
      </div>
    </>
  );
}

