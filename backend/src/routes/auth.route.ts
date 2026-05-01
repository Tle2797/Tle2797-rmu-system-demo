import { Elysia, t } from "elysia";
import {
  getMe,
  login,
  registerUser,
  updateProfile,
  uploadProfileImage,
  requestPasswordResetOtp,
  resetPasswordWithOtp,
  verifyPasswordResetOtp,
} from "../controllers/auth.controller";

export const authRoute = new Elysia({ prefix: "/api/auth" })
  .post("/login", login)
  .post("/register", registerUser, {
    body: t.Object({
      role: t.Union([t.Literal("dept_head"), t.Literal("staff")]),
      department_id: t.Number(),
      title: t.String(),
      first_name: t.String(),
      last_name: t.String(),
      username: t.String(),
      password: t.String(),
      confirmPassword: t.String(),
      email: t.String(),
    }),
  })
  .get("/me", getMe)
  .put("/profile", updateProfile)
  .post("/profile/image", uploadProfileImage)
  .post("/forgot-password/request-otp", requestPasswordResetOtp)
  .post("/forgot-password/verify-otp", verifyPasswordResetOtp)
  .post("/forgot-password/reset", resetPasswordWithOtp);
