// Indian-style rupee formatting: 123456 -> "₹1,23,456". Negative amounts get a real minus sign.
export function rupees(amount: number): string {
  const formatted = `₹${Math.abs(amount).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
  return amount < 0 ? `−${formatted}` : formatted;
}

export function rupeeRange(low: number, high: number): string {
  return low === high ? rupees(low) : `${rupees(low)}–${rupees(high)}`;
}
