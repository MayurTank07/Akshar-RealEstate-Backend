export function parseINRAmount(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const text = String(value || "").toLowerCase();
  const amount = Number.parseFloat(text.replace(/[^\d.]/g, "")) || 0;
  if (!amount) return 0;
  if (text.includes("cr") || text.includes("crore")) return amount * 10000000;
  if (text.includes("l") || text.includes("lakh") || text.includes("lac")) return amount * 100000;
  if (text.includes("k")) return amount * 1000;
  return amount;
}

export function parseMoneyToCrores(value) {
  return parseINRAmount(value) / 10000000;
}

export function formatINR(value) {
  const amount = parseINRAmount(value);
  if (!amount) return "₹0";
  if (amount >= 10000000) {
    const crores = amount / 10000000;
    return `₹${Number(crores.toFixed(crores >= 10 ? 1 : 2)).toString()} Cr`;
  }
  if (amount >= 100000) {
    const lakhs = amount / 100000;
    return `₹${Number(lakhs.toFixed(lakhs >= 10 ? 1 : 2)).toString()} Lakh`;
  }
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatCrores(value) {
  return formatINR(Number(value || 0) * 10000000);
}

export function getDateRange(query = {}) {
  const now = new Date();
  const end = query.dateTo ? new Date(query.dateTo) : new Date(now);
  end.setHours(23, 59, 59, 999);

  let start;
  if (query.dateFrom) {
    start = new Date(query.dateFrom);
  } else {
    start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const range = query.range || "this-month";
    if (range === "today") {
      // already at today start
    } else if (range === "this-week") {
      start.setDate(start.getDate() - 6);
    } else if (range === "last-30") {
      start.setDate(start.getDate() - 29);
    } else if (range === "quarterly") {
      start.setMonth(start.getMonth() - 2, 1);
    } else if (range === "six-months") {
      start.setMonth(start.getMonth() - 5, 1);
    } else if (range === "yearly" || range === "this-year") {
      start.setMonth(0, 1);
    } else if (range === "last-month") {
      start.setMonth(start.getMonth() - 1, 1);
      end.setMonth(start.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
    } else {
      start.setDate(1);
    }
  }

  start.setHours(0, 0, 0, 0);
  return { start, end };
}

export function dateMatch(field, query = {}) {
  const { start, end } = getDateRange(query);
  return { [field]: { $gte: start, $lte: end } };
}
