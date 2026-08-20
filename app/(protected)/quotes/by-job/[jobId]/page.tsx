"use client";

import { useRouter } from "next/navigation";
import { use, useEffect } from "react";
import { trpc } from "@/lib/trpc/client";

export default function QuoteByJobRedirect({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = use(params);
  const router = useRouter();
  const { data: quote } = trpc.quotes.byJobId.useQuery({ jobId });

  useEffect(() => {
    if (quote) router.replace(`/quotes/${quote.id}`);
  }, [quote, router]);

  return <p className="p-[var(--space-4)]">Loading quote...</p>;
}
