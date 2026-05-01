import { Elysia } from "elysia";
import { getHealth } from "../controllers/health.controller";

export const healthRoute = new Elysia({ prefix: "/health" }).get("/", getHealth);
