import { Elysia } from "elysia";
import { getExecYearly } from "../controllers/exec.yearly.controller";

export const execYearlyRoute = new Elysia({ prefix: "/api/exec" }).get(
  "/yearly",
  getExecYearly,
);
