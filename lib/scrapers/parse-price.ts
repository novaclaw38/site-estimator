export function parsePrice(text: string): number | null {
  const match = text.replace(/\s/g, "").match(/[\d,]+\.?\d*/);
  if (!match) return null;
  const num = Number(match[0].replace(/,/g, ""));
  return Number.isFinite(num) && num > 0 ? num : null;
}
