export const validate = (schema) => (req, _res, next) => {
  const parsed = schema.safeParse({
    body: req.body,
    params: req.params,
    query: req.query,
  });

  if (!parsed.success) {
    return next(parsed.error);
  }

  req.validated = {
    ...(req.validated || {}),
    ...parsed.data,
    body: { ...(req.validated?.body || {}), ...(parsed.data.body || {}) },
    params: { ...(req.validated?.params || {}), ...(parsed.data.params || {}) },
    query: { ...(req.validated?.query || {}), ...(parsed.data.query || {}) },
  };
  next();
};
