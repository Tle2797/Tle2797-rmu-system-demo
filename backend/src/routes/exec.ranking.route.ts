import { Elysia } from "elysia";
import { getExecRanking } from "../controllers/exec.ranking.controller";

export const execRankingRoute = new Elysia({ prefix: "/api/exec" }).get(
  "/ranking",
  getExecRanking,
);
