import { Elysia } from "elysia";
import { getDashboardStats } from "../services/dashboard-stats";

/**
 * Admin Dashboard Stats Route
 * prefix: /api/admin/dashboard
 */
export const adminDashboardRoute = new Elysia({ prefix: "/api/admin/dashboard" }).get(
  "/stats",
  async () => {
    return await getDashboardStats();
  },
);
