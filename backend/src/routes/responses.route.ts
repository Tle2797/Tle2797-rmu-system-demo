import { Elysia } from "elysia";
import { submitResponse } from "../controllers/responses.controller";

export const responsesRoute = new Elysia({ prefix: "/api/responses" }).post(
  "/",
  submitResponse,
);
