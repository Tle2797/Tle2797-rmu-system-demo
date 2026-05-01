import { Elysia } from "elysia";
import { getAdminDashboardStats } from "../controllers/admin.dashboard.controller";

export const adminDashboardRoute = new Elysia({ prefix: "/api/admin/dashboard" }).get(
  "/stats",
  getAdminDashboardStats,
);
