export interface QuoteLineItemInput {
  quantity: number;
  unitPrice: number;
}

export interface QuoteTerms {
  lineItems: QuoteLineItemInput[];
  markupPercent: number;
  laborHours: number;
  hourlyRate: number;
}

export function calculateQuoteTotals({
  lineItems,
  markupPercent,
  laborHours,
  hourlyRate,
}: QuoteTerms) {
  const totalMaterialCost = lineItems.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0,
  );
  const grandTotal =
    totalMaterialCost * (1 + markupPercent / 100) + laborHours * hourlyRate;
  return { totalMaterialCost, grandTotal };
}
