import { db } from "../config/db";

const LOW_RESPONSE_THRESHOLD = 5;
const LOW_SCORE_THRESHOLD = 3.5;
const REPORT_TIMEZONE = "Asia/Bangkok";

export async function getExecutiveDashboardStats() {
  const [
    activeSurveyRes,
    responsesRes,
    todayRes,
    coverageRes,
    topDepartmentsRes,
    attentionDepartmentsRes,
    dailyTrendRes,
    bandsRes,
  ] = await Promise.all([
    db.query(`
      SELECT id, title, year_be
      FROM surveys
      WHERE is_active = true
      ORDER BY year_be DESC, id DESC
    `),
    db.query(`
      WITH active_responses AS (
        SELECT r.id, r.respondent_group
        FROM responses r
        JOIN surveys s ON s.id = r.survey_id
        WHERE s.is_active = true
      ),
      rating_answers AS (
        SELECT a.rating
        FROM active_responses ar
        JOIN answers a ON a.response_id = ar.id
        JOIN questions q ON q.id = a.question_id
        WHERE q.type = 'rating'
      )
      SELECT
        (SELECT COUNT(*)::int FROM active_responses) AS total,
        (SELECT COUNT(*)::int FROM active_responses WHERE respondent_group = 'student') AS student,
        (SELECT COUNT(*)::int FROM active_responses WHERE respondent_group = 'staff') AS staff,
        (SELECT COUNT(*)::int FROM active_responses WHERE respondent_group = 'public') AS public,
        ROUND((SELECT AVG(rating)::numeric FROM rating_answers), 2) AS avg_rating
    `),
    db.query(`
      WITH active_responses AS (
        SELECT
          r.id,
          (timezone('${REPORT_TIMEZONE}', r.submitted_at))::date AS submitted_date_local
        FROM responses r
        JOIN surveys s ON s.id = r.survey_id
        WHERE s.is_active = true
      )
      SELECT COUNT(*)::int AS today_count
      FROM active_responses
      WHERE submitted_date_local = (timezone('${REPORT_TIMEZONE}', now()))::date
    `),
    db.query(
      `
      WITH active_departments AS (
        SELECT d.id
        FROM departments d
        WHERE d.is_active = true
      ),
      active_responses AS (
        SELECT r.id, r.department_id
        FROM responses r
        JOIN surveys s ON s.id = r.survey_id
        WHERE s.is_active = true
      ),
      response_counts AS (
        SELECT
          ar.department_id,
          COUNT(*)::int AS response_count
        FROM active_responses ar
        GROUP BY ar.department_id
      )
      SELECT
        (SELECT COUNT(*)::int FROM active_departments) AS active_departments,
        COUNT(*) FILTER (WHERE COALESCE(rc.response_count, 0) > 0)::int AS departments_with_responses,
        COUNT(*) FILTER (WHERE COALESCE(rc.response_count, 0) = 0)::int AS departments_without_responses,
        COUNT(*) FILTER (
          WHERE COALESCE(rc.response_count, 0) > 0
            AND COALESCE(rc.response_count, 0) < $1
        )::int AS low_response_departments
      FROM active_departments ad
      LEFT JOIN response_counts rc ON rc.department_id = ad.id
    `,
      [LOW_RESPONSE_THRESHOLD],
    ),
    db.query(`
      WITH active_responses AS (
        SELECT r.id, r.department_id
        FROM responses r
        JOIN surveys s ON s.id = r.survey_id
        WHERE s.is_active = true
      ),
      response_counts AS (
        SELECT
          ar.department_id,
          COUNT(*)::int AS total_responses
        FROM active_responses ar
        GROUP BY ar.department_id
      ),
      rating_avgs AS (
        SELECT
          ar.department_id,
          ROUND(AVG(a.rating)::numeric, 2) AS avg_rating
        FROM active_responses ar
        JOIN answers a ON a.response_id = ar.id
        JOIN questions q ON q.id = a.question_id
        WHERE q.type = 'rating'
        GROUP BY ar.department_id
      )
      SELECT
        d.id,
        d.name,
        rc.total_responses,
        ra.avg_rating
      FROM departments d
      JOIN response_counts rc ON rc.department_id = d.id
      LEFT JOIN rating_avgs ra ON ra.department_id = d.id
      WHERE d.is_active = true
      ORDER BY ra.avg_rating DESC NULLS LAST, rc.total_responses DESC, d.name ASC
      LIMIT 5
    `),
    db.query(
      `
      WITH active_responses AS (
        SELECT r.id, r.department_id
        FROM responses r
        JOIN surveys s ON s.id = r.survey_id
        WHERE s.is_active = true
      ),
      response_counts AS (
        SELECT
          ar.department_id,
          COUNT(*)::int AS total_responses
        FROM active_responses ar
        GROUP BY ar.department_id
      ),
      rating_avgs AS (
        SELECT
          ar.department_id,
          ROUND(AVG(a.rating)::numeric, 2) AS avg_rating
        FROM active_responses ar
        JOIN answers a ON a.response_id = ar.id
        JOIN questions q ON q.id = a.question_id
        WHERE q.type = 'rating'
        GROUP BY ar.department_id
      )
      SELECT
        d.id,
        d.name,
        COALESCE(rc.total_responses, 0)::int AS total_responses,
        ra.avg_rating,
        CASE
          WHEN COALESCE(rc.total_responses, 0) = 0 THEN 'no_data'
          WHEN COALESCE(rc.total_responses, 0) < $1 THEN 'low_response'
          WHEN COALESCE(ra.avg_rating, 0) < $2 THEN 'low_score'
          ELSE 'watch'
        END AS issue_code
      FROM departments d
      LEFT JOIN response_counts rc ON rc.department_id = d.id
      LEFT JOIN rating_avgs ra ON ra.department_id = d.id
      WHERE d.is_active = true
      ORDER BY
        CASE
          WHEN COALESCE(rc.total_responses, 0) = 0 THEN 0
          WHEN COALESCE(rc.total_responses, 0) < $1 THEN 1
          WHEN COALESCE(ra.avg_rating, 0) < $2 THEN 2
          ELSE 3
        END ASC,
        COALESCE(ra.avg_rating, 999) ASC,
        COALESCE(rc.total_responses, 0) ASC,
        d.name ASC
      LIMIT 5
    `,
      [LOW_RESPONSE_THRESHOLD, LOW_SCORE_THRESHOLD],
    ),
    db.query(`
      WITH active_responses AS (
        SELECT
          r.id,
          (timezone('${REPORT_TIMEZONE}', r.submitted_at))::date AS submitted_date_local
        FROM responses r
        JOIN surveys s ON s.id = r.survey_id
        WHERE s.is_active = true
      ),
      date_series AS (
        SELECT generate_series(
          (timezone('${REPORT_TIMEZONE}', now()))::date - 6,
          (timezone('${REPORT_TIMEZONE}', now()))::date,
          '1 day'::interval
        )::date AS day
      )
      SELECT
        ds.day,
        COUNT(ar.id)::int AS count
      FROM date_series ds
      LEFT JOIN active_responses ar
        ON ar.submitted_date_local = ds.day
      GROUP BY ds.day
      ORDER BY ds.day ASC
    `),
    db.query(`
      SELECT id, min_value, max_value, label_th, sort_order
      FROM rating_bands
      ORDER BY sort_order ASC, min_value ASC
    `),
  ]);

  const activeSurveys = activeSurveyRes.rows;
  const primarySurvey = activeSurveys[0] ?? null;

  return {
    active_survey: {
      count: activeSurveys.length,
      title: primarySurvey?.title ?? null,
      year_be: primarySurvey?.year_be ?? null,
      titles: activeSurveys.map((survey) => survey.title),
    },
    responses: {
      ...responsesRes.rows[0],
      today: todayRes.rows[0]?.today_count ?? 0,
    },
    coverage: {
      ...coverageRes.rows[0],
      low_response_threshold: LOW_RESPONSE_THRESHOLD,
    },
    top_departments: topDepartmentsRes.rows.map((row) => ({
      id: row.id,
      name: row.name,
      total_responses: row.total_responses,
      avg_rating: row.avg_rating !== null ? Number(row.avg_rating) : null,
    })),
    attention_departments: attentionDepartmentsRes.rows.map((row) => ({
      id: row.id,
      name: row.name,
      total_responses: row.total_responses,
      avg_rating: row.avg_rating !== null ? Number(row.avg_rating) : null,
      issue_code: row.issue_code,
    })),
    daily_trend: dailyTrendRes.rows,
    rating_bands: bandsRes.rows,
  };
}
