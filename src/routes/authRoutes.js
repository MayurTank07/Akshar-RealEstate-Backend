import { Router } from "express";
import { me, staffLogin, staffLogout } from "../controllers/authController.js";
import { authenticate } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { staffLoginSchema } from "../validators/schemas.js";

const router = Router();

router.post("/staff/login", validate(staffLoginSchema), staffLogin);
router.get("/me", authenticate, me);
router.post("/logout", authenticate, staffLogout);

export default router;
