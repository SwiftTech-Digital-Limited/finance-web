const PERCENT = /^\d+(?:\.\d{1,2})?$/;

export function parsePercentageInput(value: string): number | null {
  const input = value.trim();
  if (!PERCENT.test(input)) return null;
  const [whole, fraction = ""] = input.split(".");
  const bps = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(bps) && bps >= 0 && bps <= 10_000 ? bps : null;
}

export function formatPercentage(percentageBps: number) {
  const value = (percentageBps / 100)
    .toFixed(2)
    .replace(/\.00$/, "")
    .replace(/(\.\d)0$/, "$1");
  return `${value}%`;
}

export function isCompletePercentageSplit(items: { percentageBps: number }[]) {
  return (
    items.length > 0 &&
    items.reduce((sum, item) => sum + item.percentageBps, 0) === 10_000
  );
}
