import { Router } from "express";
import { analytics, dashboard } from "../controllers/analyticsController.js";
import { updateContent } from "../controllers/contentController.js";
import { deleteEnquiry, listEnquiries, updateEnquiry } from "../controllers/enquiryController.js";
import { listNotifications, markAllNotificationsRead, markNotificationRead } from "../controllers/notificationController.js";
import { listOwners, reviewOwnerDeleteRequest, updateOwnerContent, updateOwnerStatus } from "../controllers/ownerController.js";
import { checkPropertyCode, createProperty, deleteProperty, getProperty, listProperties, nextPropertyCode, updateProperty } from "../controllers/propertyController.js";
import { createPropertyOption, listPropertyOptions } from "../controllers/propertyOptionController.js";
import { exportReport, listSoldRentedReports } from "../controllers/reportController.js";
import { createStaff, deleteStaff, listStaff, updateStaff } from "../controllers/staffController.js";
import { exportUsers, listUsers, updateUserStatus, userStats } from "../controllers/userController.js";
import { avatarUpload, getAdminUploadToken, propertyImageUpload, refreshProofUrl, removeStaffCover, uploadPropertyImages, uploadStaffCover } from "../controllers/uploadController.js";
import { certificationImageUpload, createCertification, deleteCertification, listAdminCertifications, updateCertification, uploadCertificationImageHandler } from "../controllers/certificationController.js";
import { PERMISSIONS } from "../config/permissions.js";
import { authenticate, authorize, requirePermission } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  certificationCreateSchema,
  certificationUpdateSchema,
  contentUpdateSchema,
  enquiryUpdateSchema,
  ownerDeleteReviewSchema,
  ownerAdminUpdateSchema,
  idParamSchema,
  ownerStatusSchema,
  propertyOptionCreateSchema,
  propertySchema,
  staffCreateSchema,
  staffUpdateSchema,
  userStatusSchema,
} from "../validators/schemas.js";

const router = Router();

router.use(authenticate);

router.get("/dashboard", authorize("admin", "supervisor"), requirePermission(PERMISSIONS.DASHBOARD_ACCESS), dashboard);
router.get("/analytics", authorize("admin", "supervisor"), requirePermission(PERMISSIONS.ANALYTICS_ACCESS), analytics);
router.get("/notifications", authorize("admin", "supervisor"), listNotifications);
router.put("/notifications/read-all", authorize("admin", "supervisor"), markAllNotificationsRead);
router.put("/notifications/:id/read", authorize("admin", "supervisor"), validate(idParamSchema), markNotificationRead);

router.get("/properties", authorize("admin", "supervisor"), requirePermission(PERMISSIONS.ASSIGNED_VIEW), listProperties);
router.get("/property-options", authorize("admin", "supervisor"), requirePermission(PERMISSIONS.PROPERTIES_ADD, PERMISSIONS.PROPERTIES_EDIT), listPropertyOptions);
router.post("/property-options", authorize("admin", "supervisor"), requirePermission(PERMISSIONS.PROPERTIES_ADD, PERMISSIONS.PROPERTIES_EDIT), validate(propertyOptionCreateSchema), createPropertyOption);
router.get("/properties/next-code", authorize("admin", "supervisor"), requirePermission(PERMISSIONS.PROPERTIES_ADD, PERMISSIONS.PROPERTIES_EDIT), nextPropertyCode);
router.get("/properties/code/:propertyCode/available", authorize("admin", "supervisor"), requirePermission(PERMISSIONS.PROPERTIES_ADD, PERMISSIONS.PROPERTIES_EDIT), checkPropertyCode);
router.get("/properties/:id", authorize("admin", "supervisor"), requirePermission(PERMISSIONS.ASSIGNED_VIEW), validate(idParamSchema), getProperty);
router.get("/uploads/token", authorize("admin", "supervisor"), requirePermission(PERMISSIONS.PROPERTIES_ADD, PERMISSIONS.PROPERTIES_EDIT), getAdminUploadToken);
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
router.post("/staff/:id/cover", authorize("admin"), validate(idParamSchema), avatarUpload.single("cover"), uploadStaffCover);
router.delete("/staff/:id/cover", authorize("admin"), validate(idParamSchema), removeStaffCover);
router.delete("/staff/:id", authorize("admin"), validate(idParamSchema), deleteStaff);

router.get("/owners", authorize("admin", "supervisor"), requirePermission(PERMISSIONS.OWNER_MANAGEMENT), listOwners);
router.get("/owners/:id/proof-url", authorize("admin", "supervisor"), requirePermission(PERMISSIONS.OWNER_MANAGEMENT), validate(idParamSchema), refreshProofUrl);
router.put("/owners/:id", authorize("admin", "supervisor"), requirePermission(PERMISSIONS.OWNER_MANAGEMENT), validate(idParamSchema), validate(ownerAdminUpdateSchema), updateOwnerContent);
router.put("/owners/:id/status", authorize("admin", "supervisor"), requirePermission(PERMISSIONS.OWNER_MANAGEMENT), validate(idParamSchema), validate(ownerStatusSchema), updateOwnerStatus);
router.put("/owners/:id/delete", authorize("admin", "supervisor"), requirePermission(PERMISSIONS.OWNER_MANAGEMENT), validate(idParamSchema), validate(ownerDeleteReviewSchema), reviewOwnerDeleteRequest);

router.get("/users", authorize("admin"), listUsers);
router.get("/users/stats", authorize("admin"), userStats);
router.get("/users/export", authorize("admin"), exportUsers);
router.patch("/users/:id/status", authorize("admin"), validate(idParamSchema), validate(userStatusSchema), updateUserStatus);

router.put("/content/:id", authorize("admin"), validate(idParamSchema), validate(contentUpdateSchema), updateContent);
router.get("/reports/sold-rented", authorize("admin", "supervisor"), requirePermission(PERMISSIONS.REPORTS_EXPORT, PERMISSIONS.ANALYTICS_ACCESS), listSoldRentedReports);
router.get("/reports/export", authorize("admin", "supervisor"), requirePermission(PERMISSIONS.REPORTS_EXPORT, PERMISSIONS.ANALYTICS_ACCESS), exportReport);

router.get("/certifications", authorize("admin", "supervisor"), listAdminCertifications);
router.post("/certifications/upload", authorize("admin"), certificationImageUpload.single("image"), uploadCertificationImageHandler);
router.post("/certifications", authorize("admin"), validate(certificationCreateSchema), createCertification);
router.put("/certifications/:id", authorize("admin"), validate(idParamSchema), validate(certificationUpdateSchema), updateCertification);
router.delete("/certifications/:id", authorize("admin"), validate(idParamSchema), deleteCertification);

export default router;
