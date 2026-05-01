import { db } from "../config/db";

export async function getExecRanking() {
  const rankingRes = await db.query(`
    WITH active_responses AS (
      SELECT r.id, r.department_id
      FROM responses r
      JOIN surveys s ON s.id = r.survey_id
      WHERE s.is_active = true
    ),
    response_counts AS (
      SELECT
        department_id,
        COUNT(*)::int AS total_responses
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
      d.id AS department_id,
      d.name AS department_name,
      COALESCE(rc.total_responses, 0)::int AS total_responses,
      ra.avg_rating
    FROM departments d
    LEFT JOIN response_counts rc ON rc.department_id = d.id
    LEFT JOIN rating_avgs ra ON ra.department_id = d.id
    WHERE d.is_active = true
    ORDER BY ra.avg_rating DESC NULLS LAST, COALESCE(rc.total_responses, 0) DESC, d.name ASC
  `);

  const bandsRes = await db.query(`
    SELECT id, min_value, max_value, label_th, sort_order
    FROM rating_bands
    ORDER BY sort_order ASC, min_value ASC
  `);

  const overallAvgRes = await db.query(`
    WITH active_responses AS (
      SELECT r.id
      FROM responses r
      JOIN surveys s ON s.id = r.survey_id
      WHERE s.is_active = true
    )
    SELECT ROUND(AVG(a.rating)::numeric, 2) AS university_avg
    FROM active_responses ar
    JOIN answers a ON a.response_id = ar.id
    JOIN questions q ON q.id = a.question_id
    WHERE q.type = 'rating'
  `);

  const universityAvg = overallAvgRes.rows[0]?.university_avg
    ? Number(overallAvgRes.rows[0].university_avg)
    : 0;

  return {
    rankings: rankingRes.rows.map((row) => ({
      ...row,
      avg_rating: row.avg_rating !== null ? Number(row.avg_rating) : 0,
    })),
    university_avg: universityAvg,
    rating_bands: bandsRes.rows,
  };
}
