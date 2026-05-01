import { Elysia } from "elysia";
import { getExecComments } from "../controllers/exec.comments.controller";

export const execCommentsRoute = new Elysia({ prefix: "/api/exec" }).get(
  "/comments",
  getExecComments,
);
