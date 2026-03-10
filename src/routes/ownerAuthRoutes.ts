import express from "express";
import {
  ownerRegister,
  ownerLogin,
  verifyOwnerOTP,
  getOwnerMe,
  ownerLogout,
  ownerForgotPassword,
  ownerVerifyResetOTP,
  ownerResetPassword,
  ownerResendOTP,
} from "../controllers/ownerAuthController.js";
import { protectOwner } from "../middleware/ownerAuthmiddleware.js";

const router = express.Router();

// --- Public Owner Routes ---
router.post("/register", ownerRegister);
router.post("/login", ownerLogin);
router.post("/verify-otp", verifyOwnerOTP);
router.post("/resend-otp", ownerResendOTP);
router.post("/forgot-password", ownerForgotPassword);
router.post("/verify-reset-otp", ownerVerifyResetOTP);
router.post("/reset-password", ownerResetPassword);

// --- Protected Owner Routes ---
router.get("/me", protectOwner, getOwnerMe);
router.post("/logout", protectOwner, ownerLogout);

export default router;
