import { Elysia } from "elysia";
import { getExecutiveDashboardStats } from "../services/executive-dashboard-stats";

export const execDashboardRoute = new Elysia({ prefix: "/api/exec/dashboard" }).get(
  "/stats",
  async () => {
    return await getExecutiveDashboardStats();
  },
);
