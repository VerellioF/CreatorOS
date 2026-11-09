import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardContent } from "@/components/ui/card";

export default function DashboardLoading() {
  return (
    <div className="space-y-8 animate-in fade-in-50 duration-200">
      {/* 1. Header Skeleton */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-b border-border/80 pb-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-56 rounded-lg" />
            <Skeleton className="h-5 w-28 rounded-full" />
          </div>
          <Skeleton className="h-4 w-72 rounded-md" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-36 rounded-md" />
        </div>
      </div>

      {/* 2. Stat Cards Grid Skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="border-border/80 bg-card/60 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4 rounded-full" />
              <Skeleton className="h-3 w-20 rounded" />
            </div>
            <Skeleton className="h-7 w-24 rounded-md" />
          </Card>
        ))}
      </div>

      {/* 3. Main Content Cards Skeleton */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2 border-border/80 bg-card/60 p-6 space-y-4">
          <div className="flex items-center justify-between pb-2">
            <div className="space-y-1.5">
              <Skeleton className="h-5 w-48 rounded" />
              <Skeleton className="h-3.5 w-72 rounded" />
            </div>
            <Skeleton className="h-6 w-20 rounded-md" />
          </div>
          <Skeleton className="h-2 w-full rounded-full" />

          <div className="space-y-3 pt-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-card/50">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-5 w-5 rounded-full" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-3.5 w-44 rounded" />
                    <Skeleton className="h-2.5 w-64 rounded" />
                  </div>
                </div>
                <Skeleton className="h-7 w-16 rounded-md" />
              </div>
            ))}
          </div>
        </Card>

        <Card className="border-border/80 bg-card/60 p-6 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <Skeleton className="h-5 w-40 rounded" />
            <Skeleton className="h-3.5 w-full rounded" />
            <Skeleton className="h-3.5 w-4/5 rounded" />
            <Skeleton className="h-3.5 w-3/5 rounded" />
          </div>
          <Skeleton className="h-9 w-full rounded-md" />
        </Card>
      </div>
    </div>
  );
}
