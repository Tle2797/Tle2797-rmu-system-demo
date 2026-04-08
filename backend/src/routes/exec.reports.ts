import { Elysia, t } from "elysia";
import { db } from "../config/db";
import { getActiveSurvey } from "../utils/surveys";

export const execReportsRoute = new Elysia({ prefix: "/api/exec" }).get(
  "/reports",
  async ({ query, set }) => {
    const activeSurvey = await getActiveSurvey();
    if (!activeSurvey) {
      set.status = 409;
      return { message: "No active survey" };
    }

    let surveyId: number | undefined;
    if (query.surveyId !== undefined) {
      const parsedSurveyId = Number(query.surveyId);
      if (!Number.isFinite(parsedSurveyId) || parsedSurveyId <= 0) {
        set.status = 400;
        return { message: "Invalid surveyId" };
      }
      surveyId = parsedSurveyId;
    }

    let yearBe: number | undefined;
    if (query.year !== undefined) {
      const parsedYear = Number(query.year);
      if (!Number.isFinite(parsedYear)) {
        set.status = 400;
        return { message: "Invalid year" };
      }
      yearBe = parsedYear;
    }

    if (surveyId !== undefined && surveyId !== activeSurvey.id) {
      set.status = 400;
      return { message: "Requested survey is not the active survey" };
    }

    if (yearBe !== undefined && yearBe !== activeSurvey.year_be) {
      set.status = 400;
      return { message: "Requested year does not match the active survey" };
    }

    const params: number[] = [activeSurvey.id];

    const summaryRes = await db.query(
      `
      WITH filtered_responses AS (
        SELECT r.id, r.department_id, r.respondent_group
        FROM responses r
        WHERE r.survey_id = $1
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
      params,
    );

    const deptRes = await db.query(
      `
      WITH filtered_responses AS (
        SELECT r.id, r.department_id
        FROM responses r
        WHERE r.survey_id = $1
      ),
      response_counts AS (
        SELECT
          department_id,
          COUNT(*)::int AS total_responses
        FROM filtered_responses
        GROUP BY department_id
      ),
      rating_avgs AS (
        SELECT
          fr.department_id,
          ROUND(AVG(a.rating)::numeric, 2) AS avg_rating
        FROM filtered_responses fr
        JOIN answers a ON a.response_id = fr.id
        JOIN questions q ON q.id = a.question_id
        WHERE q.type = 'rating'
        GROUP BY fr.department_id
      )
      SELECT
        d.id AS department_id,
        d.name AS department_name,
        rc.total_responses,
        ra.avg_rating
      FROM departments d
      JOIN response_counts rc ON rc.department_id = d.id
      LEFT JOIN rating_avgs ra ON ra.department_id = d.id
      WHERE d.is_active = true
      ORDER BY ra.avg_rating DESC NULLS LAST, rc.total_responses DESC, d.name ASC
      `,
      params,
    );

    const bandsRes = await db.query(`
      SELECT id, min_value, max_value, label_th, sort_order
      FROM rating_bands
      ORDER BY sort_order ASC, min_value ASC
    `);

    return {
      survey: {
        id: activeSurvey.id,
        title: activeSurvey.title,
        year_be: activeSurvey.year_be,
      },
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
      departments: deptRes.rows.map((row) => ({
        ...row,
        avg_rating: Number(row.avg_rating || 0),
      })),
      rating_bands: bandsRes.rows,
      filters: {
        surveys: [
          {
            id: activeSurvey.id,
            title: String(activeSurvey.title ?? ""),
            year_be: Number(activeSurvey.year_be ?? 0),
          },
        ],
        years: activeSurvey.year_be !== null ? [activeSurvey.year_be] : [],
      },
    };
  },
  {
    query: t.Object({
      surveyId: t.Optional(t.String()),
      year: t.Optional(t.String()),
    }),
  },
);
