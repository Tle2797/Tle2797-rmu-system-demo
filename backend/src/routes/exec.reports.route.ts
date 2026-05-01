import { Elysia, t } from "elysia";
import { getExecReports } from "../controllers/exec.reports.controller";

export const execReportsRoute = new Elysia({ prefix: "/api/exec" }).get(
  "/reports",
  getExecReports,
  {
    query: t.Object({
      surveyId: t.Optional(t.String()),
      year: t.Optional(t.String()),
    }),
  },
);
