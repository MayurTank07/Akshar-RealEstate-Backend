import { Router } from "express";
import { changePassword, me, staffLogin, staffLogout, updateProfile } from "../controllers/authController.js";
import { avatarUpload, uploadAvatar } from "../controllers/uploadController.js";
import { authenticate } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { passwordChangeSchema, profileUpdateSchema, staffLoginSchema } from "../validators/schemas.js";

const router = Router();

router.post("/staff/login", validate(staffLoginSchema), staffLogin);
router.get("/me", authenticate, me);
router.put("/me", authenticate, validate(profileUpdateSchema), updateProfile);
router.put("/me/password", authenticate, validate(passwordChangeSchema), changePassword);
router.post("/me/avatar", authenticate, avatarUpload.single("avatar"), uploadAvatar);
router.post("/logout", authenticate, staffLogout);

export default router;
