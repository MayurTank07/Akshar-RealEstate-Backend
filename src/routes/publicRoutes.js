import { Router } from "express";
import { publicContent } from "../controllers/contentController.js";
import { listPublicCertifications } from "../controllers/certificationController.js";
import { createPublicEnquiry } from "../controllers/enquiryController.js";
import { createOwnerRequest, deleteMyOwnerRequest, listMyOwnerRequests, requestOwnerPropertyDelete, updateMyOwnerRequest } from "../controllers/ownerController.js";
import { listPropertyOptions } from "../controllers/propertyOptionController.js";
import { publicProperties, publicProperty } from "../controllers/propertyController.js";
import { getOwnerUploadToken, ownerMediaUpload, ownerProofUpload, uploadOwnerMedia, uploadOwnerProofs } from "../controllers/uploadController.js";
import { authenticateUser } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { enquiryCreateSchema, idParamSchema, ownerDeleteRequestSchema, ownerRequestSchema } from "../validators/schemas.js";

const router = Router();

router.get("/properties", publicProperties);
router.get("/properties/:id", validate(idParamSchema), publicProperty);
router.get("/property-options", listPropertyOptions);
router.post("/enquiries", validate(enquiryCreateSchema), createPublicEnquiry);
router.get("/content", publicContent);
router.get("/certifications", listPublicCertifications);
router.get("/owner/properties", authenticateUser, listMyOwnerRequests);
router.post("/owner/properties", authenticateUser, validate(ownerRequestSchema), createOwnerRequest);
router.put("/owner/properties/:id", authenticateUser, validate(idParamSchema), validate(ownerRequestSchema), updateMyOwnerRequest);
router.delete("/owner/properties/:id", authenticateUser, validate(idParamSchema), deleteMyOwnerRequest);
router.post("/owner/properties/:id/delete-request", authenticateUser, validate(idParamSchema), validate(ownerDeleteRequestSchema), requestOwnerPropertyDelete);
router.get("/owner/upload-token", authenticateUser, getOwnerUploadToken);
router.post("/owner/uploads", authenticateUser, ownerMediaUpload.array("files", 16), uploadOwnerMedia);
router.post("/owner/proofs", authenticateUser, ownerProofUpload.array("files", 5), uploadOwnerProofs);

export default router;
