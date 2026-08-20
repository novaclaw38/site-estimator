"use client";

import { useRouter } from "next/navigation";
import { use, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc/client";

const STATUS_LABEL: Record<string, string> = {
  queued: "Queued...",
  analyzing: "Analyzing footage...",
  pricing: "Pricing materials...",
  ready: "Ready",
  failed: "Failed",
};

export default function JobStatusPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { data: job } = trpc.jobs.byId.useQuery(
    { id },
    {
      refetchInterval: (query) =>
        query.state.data?.status === "ready" ||
        query.state.data?.status === "failed"
          ? false
          : 2000,
    },
  );

  useEffect(() => {
    if (job?.status === "ready") {
      router.push(`/quotes/by-job/${id}`);
    }
  }, [job?.status, id, router]);

  return (
    <Card className="mx-auto max-w-md text-center">
      <p className="font-mono-nums text-lg">
        {STATUS_LABEL[job?.status ?? "queued"]}
      </p>
      {job?.status === "failed" && (
        <p className="mt-[var(--space-2)] text-sm text-red-600">
          {job.errorMessage}
        </p>
      )}
    </Card>
  );
}
