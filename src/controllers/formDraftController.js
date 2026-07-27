import { FormDraft } from "../models/FormDraft.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const DRAFT_TTL_DAYS = 30;

function normalizeRecordId(recordId) {
  return String(recordId || "new").trim() || "new";
}

function draftIdentity(user, { formType, mode, recordId }) {
  const normalizedRecordId = normalizeRecordId(recordId);
  return {
    ownerId: user._id,
    ownerRole: user.role,
    formType,
    mode,
    recordId: normalizedRecordId,
    draftKey: `${user._id}:${user.role}:${formType}:${mode}:${normalizedRecordId}`,
  };
}

function expiryDate() {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + DRAFT_TTL_DAYS);
  return expiresAt;
}

function isExpired(draft) {
  return draft?.expiresAt && new Date(draft.expiresAt).getTime() <= Date.now();
}

async function findCurrentDraft(user, query) {
  const identity = draftIdentity(user, query);
  const draft = await FormDraft.findOne({
    ownerId: identity.ownerId,
    ownerRole: identity.ownerRole,
    formType: identity.formType,
    mode: identity.mode,
    recordId: identity.recordId,
    status: "active",
  }).lean();

  if (!draft || !isExpired(draft)) return draft;
  await FormDraft.updateOne({ _id: draft._id }, { $set: { status: "expired" } });
  return null;
}

export const getFormDraft = asyncHandler(async (req, res) => {
  const draft = await findCurrentDraft(req.user, req.validated.query);
  res.json({ success: true, data: draft || null });
});

export const listFormDrafts = asyncHandler(async (req, res) => {
  const filter = {
    ownerId: req.user._id,
    ownerRole: req.user.role,
    status: "active",
    expiresAt: { $gt: new Date() },
  };
  if (req.validated.query.formType) filter.formType = req.validated.query.formType;
  const drafts = await FormDraft.find(filter).sort({ updatedAt: -1 }).limit(50).lean();
  res.json({ success: true, data: drafts });
});

export const upsertFormDraft = asyncHandler(async (req, res) => {
  const { formType, mode, recordId, payload, schemaVersion } = req.validated.body;
  const identity = draftIdentity(req.user, { formType, mode, recordId });
  const draft = await FormDraft.findOneAndUpdate(
    { draftKey: identity.draftKey },
    {
      $set: {
        ...identity,
        payload,
        schemaVersion,
        status: "active",
        expiresAt: expiryDate(),
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { new: true, upsert: true }
  ).lean();

  res.json({ success: true, data: draft });
});

export const deleteFormDraft = asyncHandler(async (req, res) => {
  const identity = draftIdentity(req.user, req.validated.query);
  await FormDraft.deleteOne({
    ownerId: identity.ownerId,
    ownerRole: identity.ownerRole,
    formType: identity.formType,
    mode: identity.mode,
    recordId: identity.recordId,
  });
  res.json({ success: true, data: { deleted: true } });
});
