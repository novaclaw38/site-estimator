"use client";

import { use } from "react";
import { QuoteLineItemsTable } from "@/components/quote-line-items-table";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc/client";

export default function QuotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const utils = trpc.useUtils();
  const { data } = trpc.quotes.byId.useQuery({ id });
  const updateLineItem = trpc.quotes.updateLineItem.useMutation({
    onSuccess: () => utils.quotes.byId.invalidate({ id }),
  });
  const share = trpc.quotes.share.useMutation();

  if (!data) return <p>Loading...</p>;

  return (
    <Card className="mx-auto max-w-3xl">
      <h1 className="font-display text-2xl">{data.quote.jobTitle}</h1>
      <p className="text-[var(--color-text-muted)] mt-[var(--space-1)]">
        {data.quote.scopeOfWork}
      </p>

      <div className="mt-[var(--space-4)]">
        <QuoteLineItemsTable
          lineItems={data.lineItems}
          onUpdate={(itemId, quantity, unitPrice) =>
            updateLineItem.mutate({ id: itemId, quantity, unitPrice })
          }
        />
      </div>

      <div className="font-mono-nums mt-[var(--space-4)] text-right text-lg">
        Grand total: R{Number(data.quote.grandTotal).toFixed(2)}
      </div>

      <Button
        type="button"
        className="mt-[var(--space-3)]"
        variant="secondary"
        onClick={() => share.mutate({ id })}
      >
        Share with client
      </Button>

      {share.data && (
        <p className="mt-[var(--space-2)] text-sm">
          Client link:{" "}
          <a
            className="underline"
            href={`/quote/${share.data.shareToken}`}
            target="_blank"
            rel="noreferrer"
          >
            {typeof window !== "undefined" ? window.location.origin : ""}/quote/
            {share.data.shareToken}
          </a>
        </p>
      )}
    </Card>
  );
}
