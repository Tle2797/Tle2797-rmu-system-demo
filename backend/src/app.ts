import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import path from "path";
import fs from "fs";
import { authenticateRequest } from "./utils/jwt";
import { hasAnyRole } from "./utils/authorization";

import { healthRoute } from "./routes/health";
import { departmentsRoute } from "./routes/departments";
import { questionsRoute } from "./routes/questions";
import { responsesRoute } from "./routes/responses";
import { dashboardRoute } from "./routes/dashboard";
import { dashboardQuestionsRoute } from "./routes/dashboard.questions";
import { authRoute } from "./routes/auth";
import { adminUsersRoute } from "./routes/admin.users";
import { adminDepartmentsRoute } from "./routes/admin.departments";
import { adminQRCodesRoute } from "./routes/admin.qrcodes";
import { adminSurveysRoute } from "./routes/admin.surveys";
import { adminCentralQuestionsRoute } from "./routes/admin.questions";
import { adminTimeSlotsRoute } from "./routes/admin.time-slots";
import { adminDashboardRoute } from "./routes/admin.dashboard";
import { execYearlyRoute } from "./routes/exec.yearly";
import { execRankingRoute } from "./routes/exec.ranking";
import { execReportsRoute } from "./routes/exec.reports";
import { execDashboardRoute } from "./routes/exec.dashboard";
import { execCommentsRoute } from "./routes/exec.comments";
import { dashboardReportsRoute } from "./routes/dashboard.reports";

export const app = new Elysia()
  .use(
    cors({
      origin: ["http://localhost:3000"],
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      credentials: true,
    }),
  )
  .onBeforeHandle(async ({ request, set }) => {
    const pathname = new URL(request.url).pathname;

    if (request.method === "OPTIONS") return;

    const publicExactPaths = new Set(["/api/auth/login"]);
    const publicPrefixes = [
      "/health",
      "/api/departments",
      "/api/questions",
      "/api/responses",
      "/qrcodes",
      "/uploads",
    ];

    const isPublic =
      publicExactPaths.has(pathname) ||
      publicPrefixes.some(
        (prefix) =>
          pathname === prefix ||
          pathname.startsWith(prefix + "/") ||
          pathname.startsWith(prefix + "?"),
      );

    if (isPublic) return;

    try {
      const user = await authenticateRequest(request);

      if (pathname.startsWith("/api/admin")) {
        if (!hasAnyRole(user, ["admin"])) {
          set.status = 403;
          return { message: "Forbidden: admin access required" };
        }
        return;
      }

      if (pathname.startsWith("/api/exec")) {
        if (!hasAnyRole(user, ["admin", "exec"])) {
          set.status = 403;
          return { message: "Forbidden: executive access required" };
        }
        return;
      }

      if (pathname.startsWith("/api/dashboard")) {
        if (!hasAnyRole(user, ["admin", "dept_head", "staff"])) {
          set.status = 403;
          return { message: "Forbidden: department dashboard access required" };
        }
      }
    } catch {
      set.status = 401;
      return { message: "Unauthorized: invalid or expired token" };
    }
  })
  .use(healthRoute)
  .use(departmentsRoute)
  .use(questionsRoute)
  .use(responsesRoute)
  .use(dashboardRoute)
  .use(dashboardQuestionsRoute)
  .use(authRoute)
  .use(adminUsersRoute)
  .use(adminDepartmentsRoute)
  .use(adminQRCodesRoute)
  .use(adminSurveysRoute)
  .use(adminCentralQuestionsRoute)
  .use(adminTimeSlotsRoute)
  .use(adminDashboardRoute)
  .use(execYearlyRoute)
  .use(execRankingRoute)
  .use(execReportsRoute)
  .use(execDashboardRoute)
  .use(execCommentsRoute)
  .use(dashboardReportsRoute)
  .get("/qrcodes/:filename", ({ params, set }) => {
    const filename = params.filename;
    if (filename.includes("..") || filename.includes("/")) {
      set.status = 400;
      return "Invalid filename";
    }

    const filePath = path.resolve(process.cwd(), "public", "qrcodes", filename);
    if (!fs.existsSync(filePath)) {
      set.status = 404;
      return "Not found";
    }

    const buffer = fs.readFileSync(filePath);
    set.headers["Content-Type"] = "image/png";
    set.headers["Cache-Control"] = "no-cache";
    return new Response(buffer, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-cache",
      },
    });
  })
  .get("/uploads/profiles/:filename", ({ params, set }) => {
    const filename = params.filename;
    if (filename.includes("..") || filename.includes("/")) {
      set.status = 400;
      return "Invalid filename";
    }

    const filePath = path.resolve(
      process.cwd(),
      "public",
      "uploads",
      "profiles",
      filename,
    );
    if (!fs.existsSync(filePath)) {
      set.status = 404;
      return "Not found";
    }

    let contentType = "image/jpeg";
    if (filename.endsWith(".png")) contentType = "image/png";
    if (filename.endsWith(".webp")) contentType = "image/webp";
    if (filename.endsWith(".gif")) contentType = "image/gif";

    const buffer = fs.readFileSync(filePath);
    set.headers["Content-Type"] = contentType;
    set.headers["Cache-Control"] = "public, max-age=3600";
    return new Response(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
      },
    });
  });
