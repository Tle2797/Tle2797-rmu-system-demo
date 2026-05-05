import { Elysia, t } from "elysia";
import {
  createDashboardQuestion,
  deleteDashboardQuestion,
  listDashboardQuestions,
  updateDepartmentCentralQuestions,
  updateDashboardQuestion,
} from "../controllers/dashboard.questions.controller";

export const dashboardQuestionsRoute = new Elysia({
  prefix: "/api/dashboard/questions",
})
  .get("/:departmentId", listDashboardQuestions)
  .put("/department/:departmentId/central-selections", updateDepartmentCentralQuestions, {
    body: t.Object({
      question_ids: t.Array(t.Union([t.Number(), t.String()])),
    }),
  })
  .post("/:departmentId", createDashboardQuestion)
  .put("/:id", updateDashboardQuestion)
  .delete("/:id", deleteDashboardQuestion, {
    params: t.Object({ id: t.String() }),
    query: t.Object({
      force: t.Optional(t.String()),
    }),
  });
