"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc/client";

const STATUS_LABEL: Record<string, string> = {
  queued: "Queued",
  analyzing: "Analyzing",
  pricing: "Pricing",
  ready: "Ready",
  failed: "Failed",
};

export default function DashboardPage() {
  const { data: jobs } = trpc.jobs.list.useQuery();

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-[var(--space-4)] flex items-center justify-between">
        <h1 className="font-display text-2xl">Your jobs</h1>
        <Link href="/jobs/new">
          <Button type="button">New job</Button>
        </Link>
      </div>

      <div className="flex flex-col gap-[var(--space-2)]">
        {jobs?.length === 0 && (
          <Card>
            No jobs yet. Start by recording or uploading job-site footage.
          </Card>
        )}
        {jobs?.map((job) => (
          <Link
            key={job.id}
            href={
              job.status === "ready"
                ? `/quotes/by-job/${job.id}`
                : `/jobs/${job.id}`
            }
          >
            <Card className="flex items-center justify-between hover:bg-[var(--gray-3)]">
              <span>{new Date(job.createdAt).toLocaleString()}</span>
              <span className="font-mono-nums text-sm text-[var(--color-text-muted)]">
                {STATUS_LABEL[job.status]}
              </span>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
