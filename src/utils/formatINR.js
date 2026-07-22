export function formatINR(value) {
  const amount = Number(String(value || "").replace(/[^0-9.]/g, ""));
  if (!amount) return String(value || "");
  if (amount >= 10000000) {
    const crores = amount / 10000000;
    return `₹${Number.isInteger(crores) ? crores : crores.toFixed(2).replace(/\.?0+$/, "")} Cr`;
  }
  if (amount >= 100000) {
    const lakhs = amount / 100000;
    return `₹${Number.isInteger(lakhs) ? lakhs : lakhs.toFixed(2).replace(/\.?0+$/, "")} Lakh`;
  }
  return `₹${amount.toLocaleString("en-IN")}`;
}

