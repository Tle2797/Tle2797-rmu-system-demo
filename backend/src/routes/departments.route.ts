import { Elysia } from "elysia";
import {
  getDepartmentById,
  listDepartments,
} from "../controllers/departments.controller";

export const departmentsRoute = new Elysia({
  prefix: "/api/departments",
})
  .get("/", listDepartments)
  .get("/:id", getDepartmentById);
