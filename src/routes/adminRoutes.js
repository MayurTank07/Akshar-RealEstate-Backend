import { Router } from "express";
import { analytics, dashboard } from "../controllers/analyticsController.js";
import { updateContent } from "../controllers/contentController.js";
import { deleteEnquiry, listEnquiries, updateEnquiry } from "../controllers/enquiryController.js";
import { listOwners, updateOwnerStatus } from "../controllers/ownerController.js";
import { createProperty, deleteProperty, getProperty, listProperties, updateProperty } from "../controllers/propertyController.js";
import { exportReport } from "../controllers/reportController.js";
import { createStaff, deleteStaff, listStaff, updateStaff } from "../controllers/staffController.js";
import { propertyImageUpload, uploadPropertyImages } from "../controllers/uploadController.js";
import { PERMISSIONS } from "../config/permissions.js";
import { authenticate, authorize, requirePermission } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  contentUpdateSchema,
  enquiryUpdateSchema,
  idParamSchema,
  ownerStatusSchema,
  propertySchema,
  staffCreateSchema,
  staffUpdateSchema,
} from "../validators/schemas.js";

const router = Router();

router.use(authenticate);

router.get("/dashboard", authorize("admin", "supervisor"), requirePermission(PERMISSIONS.DASHBOARD_ACCESS), dashboard);
router.get("/analytics", authorize("admin", "supervisor"), requirePermission(PERMISSIONS.ANALYTICS_ACCESS), analytics);

router.get("/properties", authorize("admin", "supervisor"), requirePermission(PERMISSIONS.ASSIGNED_VIEW), listProperties);
router.get("/properties/:id", authorize("admin", "supervisor"), requirePermission(PERMISSIONS.ASSIGNED_VIEW), validate(idParamSchema), getProperty);
router.post("/uploads/property-images", authorize("admin", "supervisor"), requirePermission(PERMISSIONS.PROPERTIES_ADD, PERMISSIONS.PROPERTIES_EDIT), propertyImageUpload.array("images", 12), uploadPropertyImages);
router.post("/properties", authorize("admin", "supervisor"), requirePermission(PERMISSIONS.PROPERTIES_ADD), validate(propertySchema), createProperty);
router.put("/properties/:id", authorize("admin", "supervisor"), requirePermission(PERMISSIONS.PROPERTIES_EDIT, PERMISSIONS.PROPERTIES_STATUS), validate(idParamSchema), validate(propertySchema), updateProperty);
router.delete("/properties/:id", authorize("admin", "supervisor"), requirePermission(PERMISSIONS.PROPERTIES_DELETE), validate(idParamSchema), deleteProperty);

router.get("/enquiries", authorize("admin", "supervisor"), requirePermission(PERMISSIONS.ENQUIRIES_VIEW, PERMISSIONS.LEADS_MANAGE), listEnquiries);
router.put("/enquiries/:id", authorize("admin", "supervisor"), requirePermission(PERMISSIONS.LEADS_MANAGE), validate(idParamSchema), validate(enquiryUpdateSchema), updateEnquiry);
router.delete("/enquiries/:id", authorize("admin"), validate(idParamSchema), deleteEnquiry);

router.get("/staff", authorize("admin"), listStaff);
router.post("/staff", authorize("admin"), validate(staffCreateSchema), createStaff);
router.put("/staff/:id", authorize("admin"), validate(idParamSchema), validate(staffUpdateSchema), updateStaff);
router.delete("/staff/:id", authorize("admin"), validate(idParamSchema), deleteStaff);

router.get("/owners", authorize("admin"), listOwners);
router.put("/owners/:id/status", authorize("admin"), validate(idParamSchema), validate(ownerStatusSchema), updateOwnerStatus);

router.put("/content/:id", authorize("admin"), validate(idParamSchema), validate(contentUpdateSchema), updateContent);
router.get("/reports/export", authorize("admin", "supervisor"), requirePermission(PERMISSIONS.REPORTS_EXPORT), exportReport);

export default router;
