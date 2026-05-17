import { Router } from "express";
import { publicContent } from "../controllers/contentController.js";
import { createPublicEnquiry } from "../controllers/enquiryController.js";
import { publicProperties, publicProperty } from "../controllers/propertyController.js";
import { validate } from "../middleware/validate.js";
import { enquiryCreateSchema, idParamSchema } from "../validators/schemas.js";

const router = Router();

router.get("/properties", publicProperties);
router.get("/properties/:id", validate(idParamSchema), publicProperty);
router.post("/enquiries", validate(enquiryCreateSchema), createPublicEnquiry);
router.get("/content", publicContent);

export default router;
