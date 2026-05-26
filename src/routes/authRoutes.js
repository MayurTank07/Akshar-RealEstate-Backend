import { Router } from "express";
import { changePassword, listUserWishlist, me, removeUserWishlistProperty, saveUserWishlistProperty, staffLogin, staffLogout, updateProfile, userLogin, userLogout, userMe, userRegister } from "../controllers/authController.js";
import { avatarUpload, uploadAvatar } from "../controllers/uploadController.js";
import { authenticate, authenticateUser } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { passwordChangeSchema, profileUpdateSchema, staffLoginSchema, userLoginSchema, userRegisterSchema, userWishlistItemSchema } from "../validators/schemas.js";

const router = Router();

router.post("/staff/login", validate(staffLoginSchema), staffLogin);
router.post("/user/register", validate(userRegisterSchema), userRegister);
router.post("/user/login", validate(userLoginSchema), userLogin);
router.get("/user/me", authenticateUser, userMe);
router.post("/user/logout", authenticateUser, userLogout);
router.get("/user/wishlist", authenticateUser, listUserWishlist);
router.post("/user/wishlist", authenticateUser, validate(userWishlistItemSchema), saveUserWishlistProperty);
router.delete("/user/wishlist/:key", authenticateUser, removeUserWishlistProperty);
router.get("/me", authenticate, me);
router.put("/me", authenticate, validate(profileUpdateSchema), updateProfile);
router.put("/me/password", authenticate, validate(passwordChangeSchema), changePassword);
router.post("/me/avatar", authenticate, avatarUpload.single("avatar"), uploadAvatar);
router.post("/logout", authenticate, staffLogout);

export default router;
