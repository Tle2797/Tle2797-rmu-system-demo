import { Elysia } from "elysia";
import {
  getMe,
  login,
  updateProfile,
  uploadProfileImage,
  requestPasswordResetOtp,
  resetPasswordWithOtp,
  verifyPasswordResetOtp,
} from "../controllers/auth.controller";

export const authRoute = new Elysia({ prefix: "/api/auth" })
  .post("/login", login)
  .get("/me", getMe)
  .put("/profile", updateProfile)
  .post("/profile/image", uploadProfileImage)
  .post("/forgot-password/request-otp", requestPasswordResetOtp)
  .post("/forgot-password/verify-otp", verifyPasswordResetOtp)
  .post("/forgot-password/reset", resetPasswordWithOtp);
