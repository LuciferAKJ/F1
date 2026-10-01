import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background p-3">
      <div className="flex flex-1 gap-3 overflow-hidden">
        <div className="flex w-64 shrink-0 flex-col gap-3">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <Skeleton className="flex-1" />
        <div className="flex w-72 shrink-0 flex-col gap-3">
          <Skeleton className="h-56 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
      <Skeleton className="mt-3 h-16 w-full shrink-0" />
    </div>
  );
}
