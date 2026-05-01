import { Elysia } from "elysia";
import { getExecDashboardStats } from "../controllers/exec.dashboard.controller";

export const execDashboardRoute = new Elysia({ prefix: "/api/exec/dashboard" }).get(
  "/stats",
  getExecDashboardStats,
);
