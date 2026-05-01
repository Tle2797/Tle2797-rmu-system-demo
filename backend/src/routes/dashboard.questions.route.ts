import { Elysia, t } from "elysia";
import {
  createDashboardQuestion,
  deleteDashboardQuestion,
  listDashboardQuestions,
  updateDashboardQuestion,
} from "../controllers/dashboard.questions.controller";

export const dashboardQuestionsRoute = new Elysia({
  prefix: "/api/dashboard/questions",
})
  .get("/:departmentId", listDashboardQuestions)
  .post("/:departmentId", createDashboardQuestion)
  .put("/:id", updateDashboardQuestion)
  .delete("/:id", deleteDashboardQuestion, {
    params: t.Object({ id: t.String() }),
    query: t.Object({
      force: t.Optional(t.String()),
    }),
  });
