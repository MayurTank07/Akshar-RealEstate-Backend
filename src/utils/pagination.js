const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export function parsePagination(query, { defaultLimit = DEFAULT_LIMIT, maxLimit = MAX_LIMIT, allowedSortFields = [] } = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
  const skip = (page - 1) * limit;
  const sortField = allowedSortFields.includes(query.sort) ? query.sort : (allowedSortFields[0] ?? "createdAt");
  const sortOrder = query.order === "asc" ? 1 : -1;
  return { page, limit, skip, sort: { [sortField]: sortOrder } };
}
