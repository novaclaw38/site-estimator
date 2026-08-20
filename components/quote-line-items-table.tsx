"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";

export interface EditableLineItem {
  id: string;
  itemName: string;
  category: string;
  quantity: string;
  unit: string;
  vendorName: string | null;
  unitPrice: string;
}

type Props = {
  lineItems: EditableLineItem[];
  onUpdate: (id: string, quantity: number, unitPrice: number) => void;
};

export function QuoteLineItemsTable({ lineItems, onUpdate }: Props) {
  const [drafts, setDrafts] = useState<
    Record<string, { quantity: string; unitPrice: string }>
  >({});

  function draftFor(item: EditableLineItem) {
    return (
      drafts[item.id] ?? { quantity: item.quantity, unitPrice: item.unitPrice }
    );
  }

  function commit(item: EditableLineItem) {
    const draft = draftFor(item);
    onUpdate(item.id, Number(draft.quantity), Number(draft.unitPrice));
  }

  return (
    <table className="font-mono-nums w-full text-sm">
      <thead>
        <tr className="text-left text-[var(--color-text-muted)]">
          <th className="py-[var(--space-2)]">Item</th>
          <th>Vendor</th>
          <th>Qty</th>
          <th>Unit price (ZAR)</th>
        </tr>
      </thead>
      <tbody>
        {lineItems.map((item) => {
          const draft = draftFor(item);
          return (
            <tr key={item.id} className="border-t border-[var(--color-border)]">
              <td className="py-[var(--space-2)]">
                {item.itemName}{" "}
                <span className="text-[var(--color-text-muted)]">
                  ({item.unit})
                </span>
              </td>
              <td>{item.vendorName ?? "Price unavailable"}</td>
              <td className="w-20">
                <Input
                  value={draft.quantity}
                  onChange={(e) =>
                    setDrafts((d) => ({
                      ...d,
                      [item.id]: { ...draft, quantity: e.target.value },
                    }))
                  }
                  onBlur={() => commit(item)}
                />
              </td>
              <td className="w-28">
                <Input
                  value={draft.unitPrice}
                  onChange={(e) =>
                    setDrafts((d) => ({
                      ...d,
                      [item.id]: { ...draft, unitPrice: e.target.value },
                    }))
                  }
                  onBlur={() => commit(item)}
                />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
