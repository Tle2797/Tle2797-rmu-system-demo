import { db } from "../config/db";
import { generateDepartmentQRCodeAsset } from "../services/qrcode";
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

export async function getDepartmentSummary({ params, request, set }: any) {
  const departmentId = Number(params.departmentId);

  if (!Number.isFinite(departmentId) || departmentId <= 0) {
    set.status = 400;
    return { message: "Invalid departmentId" };
  }

  if (!(await ensureDepartmentAccess(request, departmentId, set))) {
    return { message: "Forbidden: cannot access this department" };
  }

  const survey = await getActiveSurvey();

  if (!survey) {
    set.status = 409;
    return { message: "No active survey" };
  }

  const kpiRes = await db.query(
    `
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE respondent_group = 'student')::int AS student,
      COUNT(*) FILTER (WHERE respondent_group = 'staff')::int AS staff,
      COUNT(*) FILTER (WHERE respondent_group = 'public')::int AS public
    FROM responses
    WHERE survey_id = $1
      AND department_id = $2
    `,
    [survey.id, departmentId],
  );

  const ratingRes = await db.query(
    `
    SELECT
      q.id AS question_id,
      q.text AS question_text,
      q.type AS question_type,
      COUNT(a.rating)::int AS n,
      CASE
        WHEN q.type = 'rating' THEN ROUND(AVG(a.rating)::numeric, 2)
        ELSE NULL
      END AS avg,
      CASE
        WHEN q.type = 'rating' THEN ROUND(stddev_samp(a.rating)::numeric, 2)
        ELSE NULL
      END AS sd,
      COUNT(*) FILTER (WHERE a.rating = 1)::int AS r1,
      COUNT(*) FILTER (WHERE a.rating = 2)::int AS r2,
      COUNT(*) FILTER (WHERE a.rating = 3)::int AS r3,
      COUNT(*) FILTER (WHERE a.rating = 4)::int AS r4,
      COUNT(*) FILTER (WHERE a.rating = 5)::int AS r5
    FROM questions q
    LEFT JOIN responses r
      ON r.survey_id = q.survey_id
     AND r.department_id = $2
    LEFT JOIN answers a
      ON a.response_id = r.id
     AND a.question_id = q.id
    WHERE q.survey_id = $1
      AND q.status = 'active'
      AND (
        q.scope = 'central'
        OR (q.scope = 'department' AND q.department_id = $2)
      )
    GROUP BY q.id, q.text, q.type
    ORDER BY q.display_order ASC, q.id ASC
    `,
    [survey.id, departmentId],
  );

  const bandsRes = await db.query(`
    SELECT id, min_value, max_value, label_th, sort_order
    FROM rating_bands
    ORDER BY sort_order ASC, min_value ASC
  `);

  return {
    survey: { id: survey.id, year_be: survey.year_be, title: survey.title },
    rating_bands: bandsRes.rows,
    kpi: kpiRes.rows[0],
    ratings: ratingRes.rows,
  };
}

export async function getDepartmentComments({ params, query, request, set }: any) {
  const departmentId = Number(params.departmentId);
  const limit = Math.min(Number(query.limit) || 20, 100);
  const offset = Number(query.offset) || 0;

  if (!Number.isFinite(departmentId) || departmentId <= 0) {
    set.status = 400;
    return { message: "Invalid departmentId" };
  }

  if (!(await ensureDepartmentAccess(request, departmentId, set))) {
    return { message: "Forbidden: cannot access this department" };
  }

  const survey = await getActiveSurvey();

  if (!survey) {
    set.status = 409;
    return { message: "No active survey" };
  }

  const surveyId = survey.id;

  const countRes = await db.query(
    `
    SELECT COUNT(*)::int AS total
    FROM answers a
    JOIN questions q ON q.id = a.question_id
    JOIN responses r ON r.id = a.response_id
    WHERE q.survey_id = $1
      AND r.department_id = $2
      AND q.type = 'text'
      AND a.comment IS NOT NULL
      AND btrim(a.comment) <> ''
    `,
    [surveyId, departmentId],
  );

  const commentsRes = await db.query(
    `
    SELECT
      a.id AS answer_id,
      q.id AS question_id,
      q.text AS question_text,
      r.respondent_group,
      a.comment,
      r.submitted_at
    FROM answers a
    JOIN questions q ON q.id = a.question_id
    JOIN responses r ON r.id = a.response_id
    WHERE q.survey_id = $1
      AND r.department_id = $2
      AND q.type = 'text'
      AND a.comment IS NOT NULL
      AND btrim(a.comment) <> ''
    ORDER BY r.submitted_at DESC
    LIMIT $3 OFFSET $4
    `,
    [surveyId, departmentId, limit, offset],
  );

  return {
    total: countRes.rows[0].total,
    limit,
    offset,
    items: commentsRes.rows,
  };
}

export async function getDepartmentYearly({ params, query, request, set }: any) {
  const departmentId = Number(params.departmentId);
  if (!Number.isFinite(departmentId) || departmentId <= 0) {
    set.status = 400;
    return { message: "Invalid departmentId" };
  }

  if (!(await ensureDepartmentAccess(request, departmentId, set))) {
    return { message: "Forbidden: cannot access this department" };
  }

  const from = query.from ? Number(query.from) : null;
  const to = query.to ? Number(query.to) : null;

  const deptRes = await db.query(
    `SELECT id, name FROM departments WHERE id = $1 AND is_active = true`,
    [departmentId],
  );
  if (deptRes.rowCount === 0) {
    set.status = 404;
    return { message: "Department not found" };
  }
  const department = deptRes.rows[0];

  const rowsRes = await db.query(
    `
    WITH yearly AS (
      SELECT
        s.year_be::int AS year_be,
        ROUND(AVG(a.rating)::numeric, 2) AS avg_rating,
        COUNT(DISTINCT r.id)::int AS respondents_total,
        COUNT(DISTINCT r.id) FILTER (WHERE r.respondent_group = 'student')::int AS student,
        COUNT(DISTINCT r.id) FILTER (WHERE r.respondent_group = 'staff')::int AS staff,
        COUNT(DISTINCT r.id) FILTER (WHERE r.respondent_group = 'public')::int AS public
      FROM responses r
      JOIN surveys s ON s.id = r.survey_id
      LEFT JOIN answers a ON a.response_id = r.id
      LEFT JOIN questions q ON q.id = a.question_id
      WHERE r.department_id = $1
        AND (q.type = 'rating' OR q.id IS NULL)
        AND ($2::int IS NULL OR s.year_be >= $2::int)
        AND ($3::int IS NULL OR s.year_be <= $3::int)
      GROUP BY s.year_be
    ),
    banded AS (
      SELECT
        y.*,
        rb.label_th AS band_label
      FROM yearly y
      LEFT JOIN LATERAL (
        SELECT label_th
        FROM rating_bands
        WHERE y.avg_rating IS NOT NULL
          AND y.avg_rating >= min_value
          AND y.avg_rating <= max_value
        ORDER BY sort_order DESC
        LIMIT 1
      ) rb ON true
    )
    SELECT *
    FROM banded
    ORDER BY year_be ASC
    `,
    [departmentId, from, to],
  );

  const rows = rowsRes.rows as Array<{
    year_be: number;
    avg_rating: number | null;
    band_label: string | null;
    respondents_total: number;
    student: number;
    staff: number;
    public: number;
  }>;

  const totals = rows.reduce(
    (acc, row) => {
      acc.respondents_total += row.respondents_total || 0;
      acc.student += row.student || 0;
      acc.staff += row.staff || 0;
      acc.public += row.public || 0;
      return acc;
    },
    { respondents_total: 0, student: 0, staff: 0, public: 0 },
  );

  const overallRes = await db.query(
    `
    WITH base AS (
      SELECT ROUND(AVG(a.rating)::numeric, 2) AS overall_avg
      FROM responses r
      JOIN surveys s ON s.id = r.survey_id
      JOIN answers a ON a.response_id = r.id
      JOIN questions q ON q.id = a.question_id
      WHERE r.department_id = $1
        AND q.type = 'rating'
        AND ($2::int IS NULL OR s.year_be >= $2::int)
        AND ($3::int IS NULL OR s.year_be <= $3::int)
    )
    SELECT
      b.overall_avg,
      rb.label_th AS overall_band
    FROM base b
    LEFT JOIN LATERAL (
      SELECT label_th
      FROM rating_bands
      WHERE b.overall_avg IS NOT NULL
        AND b.overall_avg >= min_value
        AND b.overall_avg <= max_value
      ORDER BY sort_order DESC
      LIMIT 1
    ) rb ON true
    `,
    [departmentId, from, to],
  );

  const overall_avg = overallRes.rows?.[0]?.overall_avg ?? null;
  const overall_band = overallRes.rows?.[0]?.overall_band ?? null;
  const minYear = rows.length ? Math.min(...rows.map((row) => row.year_be)) : null;
  const maxYear = rows.length ? Math.max(...rows.map((row) => row.year_be)) : null;

  return {
    department,
    from: from ?? minYear ?? null,
    to: to ?? maxYear ?? null,
    years_with_data: rows.length,
    respondents_total: totals.respondents_total,
    student: totals.student,
    staff: totals.staff,
    public: totals.public,
    overall_avg,
    overall_band,
    rows,
  };
}

export async function resetDepartmentQRCode({ params, request, set }: any) {
  const departmentId = Number(params.departmentId);

  if (!Number.isFinite(departmentId) || departmentId <= 0) {
    set.status = 400;
    return { message: "Invalid departmentId" };
  }

  if (!(await ensureDepartmentAccess(request, departmentId, set))) {
    return { message: "Forbidden: cannot access this department" };
  }

  const deptRes = await db.query(
    `SELECT id, name, is_active
     FROM departments
     WHERE id = $1
       AND is_active = true`,
    [departmentId],
  );

  if (deptRes.rowCount === 0) {
    set.status = 404;
    return { message: "Department not found" };
  }

  const department = deptRes.rows[0];
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const qrAsset = await generateDepartmentQRCodeAsset(departmentId);

    await client.query(
      `DELETE FROM qrcodes WHERE type = 'department' AND department_id = $1`,
      [departmentId],
    );

    await client.query(
      `INSERT INTO qrcodes (type, department_id, image_path, link_target, is_active)
       VALUES ('department', $1, $2, $3, true)`,
      [departmentId, qrAsset.imagePath, qrAsset.link],
    );

    const qrRes = await client.query(
      `SELECT id, image_path, link_target, created_at
       FROM qrcodes
       WHERE type = 'department' AND department_id = $1
       LIMIT 1`,
      [departmentId],
    );

    await client.query("COMMIT");

    const qrcode = qrRes.rows[0];

    return {
      message: "QR Code เธซเธเนเธงเธขเธเธฒเธเธฃเธตเน€เธเธ•เธชเธณเน€เธฃเนเธ",
      department: {
        id: department.id,
        name: department.name,
        is_active: department.is_active,
        qrcode_id: qrcode.id,
        image_path: qrcode.image_path,
        link_target: qrcode.link_target,
        qr_created_at: qrcode.created_at,
      },
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
