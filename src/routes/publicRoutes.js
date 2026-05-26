import { Router } from "express";
import { publicContent } from "../controllers/contentController.js";
import { createPublicEnquiry } from "../controllers/enquiryController.js";
import { createOwnerRequest, listMyOwnerRequests, updateMyOwnerRequest } from "../controllers/ownerController.js";
import { publicProperties, publicProperty } from "../controllers/propertyController.js";
import { ownerMediaUpload, uploadOwnerMedia } from "../controllers/uploadController.js";
import { authenticateUser } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { enquiryCreateSchema, idParamSchema, ownerRequestSchema } from "../validators/schemas.js";

const router = Router();

router.get("/properties", publicProperties);
router.get("/properties/:id", validate(idParamSchema), publicProperty);
router.post("/enquiries", validate(enquiryCreateSchema), createPublicEnquiry);
router.get("/content", publicContent);
router.get("/owner/properties", authenticateUser, listMyOwnerRequests);
router.post("/owner/properties", authenticateUser, validate(ownerRequestSchema), createOwnerRequest);
router.put("/owner/properties/:id", authenticateUser, validate(idParamSchema), validate(ownerRequestSchema), updateMyOwnerRequest);
router.post("/owner/uploads", authenticateUser, ownerMediaUpload.array("files", 16), uploadOwnerMedia);

export default router;
