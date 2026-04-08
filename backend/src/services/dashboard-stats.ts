import { db } from "../config/db";

export async function getDashboardStats() {
  const [
    usersRes,
    deptsRes,
    surveysRes,
    timeslotsRes,
    responsesRes,
    todayRes,
    recentRes,
    topDeptsRes,
    dailyTrendRes,
    bandsRes,
  ] = await Promise.all([
    db.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE is_active = true)::int AS active,
        COUNT(*) FILTER (WHERE is_active = false)::int AS inactive
      FROM users
    `),
    db.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE is_active = true)::int AS active,
        COUNT(*) FILTER (WHERE is_active = false)::int AS inactive
      FROM departments
    `),
    db.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE is_active = true)::int AS active
      FROM surveys
    `),
    db.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE is_active = true)::int AS active
      FROM time_slots
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
        SELECT r.id, r.submitted_at
        FROM responses r
        JOIN surveys s ON s.id = r.survey_id
        WHERE s.is_active = true
      )
      SELECT COUNT(*)::int AS today_count
      FROM active_responses
      WHERE submitted_at::date = CURRENT_DATE
    `),
    db.query(`
      SELECT
        r.id,
        r.respondent_group,
        r.submitted_at,
        d.name AS department_name,
        s.title AS survey_title
      FROM responses r
      JOIN surveys s ON s.id = r.survey_id
      JOIN departments d ON d.id = r.department_id
      ORDER BY r.submitted_at DESC
      LIMIT 5
    `),
    db.query(`
      WITH active_responses AS (
        SELECT r.id, r.department_id
        FROM responses r
        JOIN surveys s ON s.id = r.survey_id
        WHERE s.is_active = true
      ),
      response_counts AS (
        SELECT
          department_id,
          COUNT(*)::int AS response_count
        FROM active_responses
        GROUP BY department_id
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
        COALESCE(rc.response_count, 0)::int AS response_count,
        ra.avg_rating
      FROM departments d
      LEFT JOIN response_counts rc ON rc.department_id = d.id
      LEFT JOIN rating_avgs ra ON ra.department_id = d.id
      WHERE d.is_active = true
      ORDER BY COALESCE(rc.response_count, 0) DESC, ra.avg_rating DESC NULLS LAST, d.id ASC
      LIMIT 5
    `),
    db.query(`
      WITH active_responses AS (
        SELECT r.id, r.submitted_at
        FROM responses r
        JOIN surveys s ON s.id = r.survey_id
        WHERE s.is_active = true
      )
      SELECT
        d.date::date AS day,
        COUNT(ar.id)::int AS count
      FROM generate_series(
        CURRENT_DATE - interval '6 days',
        CURRENT_DATE,
        '1 day'
      ) AS d(date)
      LEFT JOIN active_responses ar
        ON ar.submitted_at::date = d.date::date
      GROUP BY d.date
      ORDER BY d.date ASC
    `),
    db.query(`
      SELECT id, min_value, max_value, label_th, sort_order
      FROM rating_bands
      ORDER BY sort_order ASC, min_value ASC
    `),
  ]);

  return {
    users: usersRes.rows[0],
    departments: deptsRes.rows[0],
    surveys: surveysRes.rows[0],
    time_slots: timeslotsRes.rows[0],
    responses: {
      ...responsesRes.rows[0],
      today: todayRes.rows[0]?.today_count ?? 0,
    },
    recent_responses: recentRes.rows,
    top_departments: topDeptsRes.rows,
    daily_trend: dailyTrendRes.rows,
    rating_bands: bandsRes.rows,
  };
}
