import { Elysia, t } from "elysia";
import { db } from "../config/db";
import { authenticateRequest } from "../utils/auth";
import { canAccessDepartment } from "../utils/authorization";
import { getActiveSurvey } from "../utils/surveys";

async function ensureDepartmentAccess(
  request: Request,
  departmentId: number,
  set: { status?: number | string },
) {
  const user = await authenticateRequest(request);
  if (!canAccessDepartment(user, departmentId)) {
    set.status = 403;
    return false;
  }

  return true;
}

export const dashboardReportsRoute = new Elysia({ prefix: "/api/dashboard" }).get(
  "/department/:departmentId/reports",
  async ({ params, query, request, set }) => {
    const departmentId = Number(params.departmentId);
    if (!Number.isFinite(departmentId) || departmentId <= 0) {
      set.status = 400;
      return { message: "Invalid departmentId" };
    }

    if (!(await ensureDepartmentAccess(request, departmentId, set))) {
      return { message: "Forbidden: cannot access this department" };
    }

    const activeSurvey = await getActiveSurvey();
    if (!activeSurvey) {
      set.status = 409;
      return { message: "No active survey" };
    }

    let timeSlotId: number | undefined;
    if (query.timeSlotId !== undefined) {
      const parsedTimeSlotId = Number(query.timeSlotId);
      if (!Number.isFinite(parsedTimeSlotId) || parsedTimeSlotId <= 0) {
        set.status = 400;
        return { message: "Invalid timeSlotId" };
      }
      timeSlotId = parsedTimeSlotId;
    }

    let year: number | undefined;
    if (query.year !== undefined) {
      const parsedYear = Number(query.year);
      if (!Number.isFinite(parsedYear)) {
        set.status = 400;
        return { message: "Invalid year" };
      }
      year = parsedYear;
    }

    if (query.year !== undefined && !Number.isFinite(year)) {
      set.status = 400;
      return { message: "Invalid year" };
    }

    if (year !== undefined && year !== activeSurvey.year_be) {
      set.status = 400;
      return { message: "Requested year does not match the active survey" };
    }

    let filterClause = " AND r.department_id = $1 AND r.survey_id = $2";
    const paramsList: Array<number> = [departmentId, activeSurvey.id];

    if (timeSlotId) {
      filterClause += ` AND r.slot_id = $${paramsList.length + 1}`;
      paramsList.push(timeSlotId!);
    }

    const summaryRes = await db.query(
      `
      WITH filtered_responses AS (
        SELECT r.id, r.respondent_group
        FROM responses r
        WHERE 1 = 1
        ${filterClause}
      ),
      rating_answers AS (
        SELECT a.rating
        FROM filtered_responses fr
        JOIN answers a ON a.response_id = fr.id
        JOIN questions q ON q.id = a.question_id
        WHERE q.type = 'rating'
      )
      SELECT
        (SELECT COUNT(*)::int FROM filtered_responses) AS total_responses,
        ROUND((SELECT AVG(rating)::numeric FROM rating_answers), 2) AS avg_rating,
        (SELECT COUNT(*)::int FROM filtered_responses WHERE respondent_group = 'student') AS student_count,
        (SELECT COUNT(*)::int FROM filtered_responses WHERE respondent_group = 'staff') AS staff_count,
        (SELECT COUNT(*)::int FROM filtered_responses WHERE respondent_group = 'public') AS public_count
      `,
      paramsList,
    );

    const questionsRes = await db.query(
      `
      WITH filtered_responses AS (
        SELECT r.id
        FROM responses r
        WHERE 1 = 1
        ${filterClause}
      )
      SELECT
        q.id AS question_id,
        q.text AS question_text,
        COUNT(a.id)::int AS total_responses,
        ROUND(AVG(a.rating)::numeric, 2) AS avg_rating,
        ROUND(stddev_samp(a.rating)::numeric, 2) AS sd
      FROM filtered_responses fr
      JOIN answers a ON a.response_id = fr.id
      JOIN questions q ON q.id = a.question_id
      WHERE q.type = 'rating'
      GROUP BY q.id, q.text, q.display_order
      ORDER BY q.display_order ASC, q.id ASC
      `,
      paramsList,
    );

    const timeSlotsRes = await db.query(
      `
      SELECT
        ts.id,
        ts.name AS title,
        ts.start_time AS start_date,
        ts.end_time AS end_date
      FROM time_slots ts
      WHERE ts.is_active = true
        AND (
          EXISTS (
            SELECT 1
            FROM survey_time_slots sts
            WHERE sts.survey_id = $1
              AND sts.slot_id = ts.id
          )
          OR NOT EXISTS (
            SELECT 1
            FROM survey_time_slots sts
            WHERE sts.survey_id = $1
          )
        )
      ORDER BY ts.start_time ASC, ts.id ASC
      `,
      [activeSurvey.id],
    );
    const bandsRes = await db.query(`
      SELECT id, min_value, max_value, label_th, sort_order
      FROM rating_bands
      ORDER BY sort_order ASC, min_value ASC
    `);
    const deptRes = await db.query(`SELECT id, name FROM departments WHERE id = $1`, [
      departmentId,
    ]);

    return {
      survey: {
        id: activeSurvey.id,
        title: activeSurvey.title,
        year_be: activeSurvey.year_be,
      },
      department: deptRes.rows[0] || { id: departmentId, name: "Department not found" },
      summary: {
        ...(summaryRes.rows[0] || {
          total_responses: 0,
          avg_rating: 0,
          student_count: 0,
          staff_count: 0,
          public_count: 0,
        }),
        avg_rating: Number(summaryRes.rows[0]?.avg_rating || 0),
      },
      questions: questionsRes.rows.map((question) => ({
        ...question,
        avg_rating: Number(question.avg_rating || 0),
        sd: question.sd === null ? null : Number(question.sd || 0),
      })),
      rating_bands: bandsRes.rows,
      filters: {
        time_slots: timeSlotsRes.rows,
        years: activeSurvey.year_be !== null ? [activeSurvey.year_be] : [],
      },
    };
  },
  {
    params: t.Object({
      departmentId: t.String(),
    }),
    query: t.Object({
      timeSlotId: t.Optional(t.String()),
      year: t.Optional(t.String()),
    }),
  },
);
