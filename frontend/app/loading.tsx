import { Skeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-44 rounded-xl" />
        <Skeleton className="h-8 w-32 rounded-xl" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>

      <Skeleton className="h-96 w-full rounded-2xl" />
    </div>
  );
}
