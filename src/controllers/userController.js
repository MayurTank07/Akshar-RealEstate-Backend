import { User } from "../models/User.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { escapeRegExp } from "../utils/escapeRegExp.js";
import { parsePagination } from "../utils/pagination.js";

const USER_SORT_FIELDS = ["createdAt", "name", "email", "status", "lastLoginAt"];

export const listUsers = asyncHandler(async (req, res) => {
  const search = req.query.search?.trim() || "";
  const authProvider = req.query.authProvider || "";
  const status = req.query.status || "";
  const role = req.query.role || "";
  const dateFrom = req.query.dateFrom || "";
  const dateTo = req.query.dateTo || "";

  const filter = {};

  if (search) {
    const safeSearch = escapeRegExp(search);
    filter.$or = [
      { name: { $regex: safeSearch, $options: "i" } },
      { email: { $regex: safeSearch, $options: "i" } },
      { phone: { $regex: safeSearch, $options: "i" } },
    ];
  }
  if (authProvider) filter.authProvider = authProvider;
  if (status) filter.status = status;
  if (role) filter.role = role;
  if (dateFrom || dateTo) {
    filter.createdAt = {};
    if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }

  const { page, limit, skip, sort } = parsePagination(req.query, { allowedSortFields: USER_SORT_FIELDS });
  const [users, total] = await Promise.all([
    User.find(filter)
      .select("-passwordHash -savedProperties -tokenVersion -googleId")
      .sort(sort)
      .skip(skip)
      .limit(limit),
    User.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: users,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
  });
});

export const userStats = asyncHandler(async (_req, res) => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [total, todayCount, monthCount, googleCount, emailCount, activeCount] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ createdAt: { $gte: todayStart } }),
    User.countDocuments({ createdAt: { $gte: monthStart } }),
    User.countDocuments({ authProvider: "google" }),
    User.countDocuments({ authProvider: "local" }),
    User.countDocuments({ status: "active" }),
  ]);

  res.json({
    success: true,
    data: { total, todayCount, monthCount, googleCount, emailCount, activeCount, disabledCount: total - activeCount },
  });
});

export const updateUserStatus = asyncHandler(async (req, res) => {
  const { status } = req.validated.body;

  const user = await User.findById(req.validated.params.id);
  if (!user) throw new ApiError(404, "User not found");

  user.status = status;
  if (status === "disabled") {
    user.tokenVersion = (user.tokenVersion || 0) + 1;
  }
  await user.save();

  res.json({ success: true, data: { _id: user._id, status: user.status } });
});

export const exportUsers = asyncHandler(async (req, res) => {
  const format = req.query.format === "pdf" ? "pdf" : "excel";
  const authProvider = req.query.authProvider || "";
  const status = req.query.status || "";
  const role = req.query.role || "";
  const dateFrom = req.query.dateFrom || "";
  const dateTo = req.query.dateTo || "";

  const filter = {};
  if (authProvider) filter.authProvider = authProvider;
  if (status) filter.status = status;
  if (role) filter.role = role;
  if (dateFrom || dateTo) {
    filter.createdAt = {};
    if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }

  const users = await User.find(filter)
    .select("-passwordHash -savedProperties -tokenVersion -googleId")
    .sort({ createdAt: -1 })
    .limit(5000);

  const fmt = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "");
  const exportDate = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });

  if (format === "pdf") {
    const rows = users
      .map(
        (u) => `<tr>
      <td>${u.name}</td><td>${u.email}</td><td>${u.phone || "—"}</td>
      <td>${u.authProvider === "google" ? "Google" : "Email"}</td>
      <td class="cap">${u.role}</td>
      <td class="${u.status === "active" ? "green" : "red"}">${u.status}</td>
      <td>${fmt(u.createdAt)}</td><td>${u.lastLoginAt ? fmt(u.lastLoginAt) : "Never"}</td>
    </tr>`
      )
      .join("");

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>User Report</title>
<style>body{font-family:Arial,sans-serif;font-size:12px;color:#1e293b}h1{font-size:18px;color:#1e40af;margin-bottom:4px}.meta{color:#64748b;font-size:11px;margin-bottom:20px}table{width:100%;border-collapse:collapse}th{background:#1e40af;color:#fff;padding:8px 10px;text-align:left;font-size:11px}td{border-bottom:1px solid #e2e8f0;padding:7px 10px;font-size:11px}tr:nth-child(even) td{background:#f8fafc}.cap{text-transform:capitalize}.green{color:#059669;font-weight:bold}.red{color:#dc2626;font-weight:bold}</style>
</head><body>
<h1>User Management Report — Akshar Estate</h1>
<div class="meta">Exported on ${exportDate} &nbsp;|&nbsp; Total records: ${users.length}</div>
<table><thead><tr><th>Name</th><th>Email</th><th>Mobile</th><th>Method</th><th>Role</th><th>Status</th><th>Registered</th><th>Last Login</th></tr></thead>
<tbody>${rows}</tbody></table></body></html>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="users-${Date.now()}.html"`);
    return res.send(html);
  }

  const header = ["Name", "Email", "Mobile", "Registration Method", "Role", "Status", "Registered On", "Last Login"].join("\t");
  const dataRows = users
    .map((u) =>
      [
        u.name,
        u.email,
        u.phone || "",
        u.authProvider === "google" ? "Google" : "Email",
        u.role,
        u.status,
        fmt(u.createdAt),
        u.lastLoginAt ? fmt(u.lastLoginAt) : "Never",
      ].join("\t")
    )
    .join("\n");

  res.setHeader("Content-Type", "application/vnd.ms-excel");
  res.setHeader("Content-Disposition", `attachment; filename="users-${Date.now()}.xls"`);
  res.send(`${header}\n${dataRows}`);
});
