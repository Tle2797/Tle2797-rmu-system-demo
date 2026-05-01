import { Elysia } from "elysia";
import { listSurveyQuestions } from "../controllers/questions.controller";

export const questionsRoute = new Elysia({
  prefix: "/api/questions",
}).get("/:departmentId", listSurveyQuestions);
