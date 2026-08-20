"use client";

import { use } from "react";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc/client";

export default function PublicQuotePage({
  params,
}: {
  params: Promise<{ shareToken: string }>;
}) {
  const { shareToken } = use(params);
  const { data } = trpc.quotes.byShareToken.useQuery({ token: shareToken });

  if (!data) return <p className="p-[var(--space-4)]">Loading...</p>;

  return (
    <div className="min-h-screen p-[var(--space-4)]">
      <Card className="mx-auto max-w-3xl">
        <h1 className="font-display text-2xl">{data.quote.jobTitle}</h1>
        <p className="text-[var(--color-text-muted)] mt-[var(--space-1)]">
          {data.quote.scopeOfWork}
        </p>

        <table className="font-mono-nums mt-[var(--space-4)] w-full text-sm">
          <thead>
            <tr className="text-left text-[var(--color-text-muted)]">
              <th className="py-[var(--space-2)]">Item</th>
              <th>Qty</th>
              <th>Unit price</th>
            </tr>
          </thead>
          <tbody>
            {data.lineItems.map((item) => (
              <tr
                key={item.id}
                className="border-t border-[var(--color-border)]"
              >
                <td className="py-[var(--space-2)]">
                  {item.itemName} ({item.unit})
                </td>
                <td>{item.quantity}</td>
                <td>R{Number(item.unitPrice).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="font-mono-nums mt-[var(--space-4)] text-right text-lg font-semibold">
          Grand total: R{Number(data.quote.grandTotal).toFixed(2)}
        </div>
      </Card>
    </div>
  );
}
