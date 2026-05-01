import { db } from "../config/db";

function getCurrentBEYear() {
  return new Date().getFullYear() + 543;
}

export async function getExecYearly() {
  const currentBEYear = getCurrentBEYear();
  const yearsBE = [
    currentBEYear - 4,
    currentBEYear - 3,
    currentBEYear - 2,
    currentBEYear - 1,
    currentBEYear,
  ];

  const yearlyOverviewRes = await db.query(
    `
    SELECT
      s.year_be::int AS year_be,
      ROUND(AVG(a.rating)::numeric, 2) AS avg_rating
    FROM responses r
    JOIN surveys s ON s.id = r.survey_id
    JOIN answers a ON a.response_id = r.id
    JOIN questions q ON q.id = a.question_id
    WHERE q.type = 'rating'
      AND s.year_be >= $1
    GROUP BY s.year_be
    ORDER BY s.year_be ASC
    `,
    [currentBEYear - 4],
  );

  const ratingBandsRes = await db.query(`
    SELECT id, min_value, max_value, label_th, sort_order
    FROM rating_bands
    ORDER BY sort_order ASC, min_value ASC
  `);

  const deptRes = await db.query(
    `
    SELECT
      d.id AS department_id,
      d.name AS department_name,
      s.year_be::int AS year_be,
      ROUND(AVG(a.rating)::numeric, 2) AS avg_rating
    FROM responses r
    JOIN departments d
      ON d.id = r.department_id
     AND d.is_active = true
    JOIN surveys s
      ON s.id = r.survey_id
     AND s.year_be >= $1
    JOIN answers a ON a.response_id = r.id
    JOIN questions q
      ON q.id = a.question_id
     AND q.type = 'rating'
    GROUP BY d.id, d.name, s.year_be
    ORDER BY d.name ASC, s.year_be ASC
    `,
    [currentBEYear - 4],
  );

  const yearlyOverview = yearsBE.map((yearBE) => {
    const found = yearlyOverviewRes.rows.find(
      (row) => Number(row.year_be) === yearBE,
    );

    return {
      year: yearBE - 543,
      year_th: yearBE,
      avg_rating: found ? Number(found.avg_rating) : 0,
    };
  });

  const departmentsMap = new Map<
    number,
    {
      department_id: number;
      department_name: string;
      scores: Record<string, number>;
      latest_diff: number;
    }
  >();

  const allActiveDepts = await db.query(
    `SELECT id, name FROM departments WHERE is_active = true ORDER BY name ASC`,
  );

  allActiveDepts.rows.forEach((department) => {
    const initScores: Record<string, number> = {};
    yearsBE.forEach((yearBE) => {
      initScores[String(yearBE)] = 0;
    });

    departmentsMap.set(Number(department.id), {
      department_id: Number(department.id),
      department_name: String(department.name),
      scores: initScores,
      latest_diff: 0,
    });
  });

  deptRes.rows.forEach((row) => {
    const departmentId = Number(row.department_id);
    const yearBE = Number(row.year_be);
    const department = departmentsMap.get(departmentId);

    if (!department || !yearBE) return;
    department.scores[String(yearBE)] = Number(row.avg_rating);
  });

  const departmentsDetail = Array.from(departmentsMap.values()).map(
    (department) => {
      const currentValue = department.scores[String(currentBEYear)] ?? 0;
      const previousValue = department.scores[String(currentBEYear - 1)] ?? 0;

      department.latest_diff = Number(
        (currentValue - previousValue).toFixed(2),
      );
      return department;
    },
  );

  return {
    years_list: yearsBE,
    yearly_overview: yearlyOverview,
    departments_detail: departmentsDetail,
    rating_bands: ratingBandsRes.rows.map((row) => ({
      id: Number(row.id),
      min_value: Number(row.min_value),
      max_value: Number(row.max_value),
      label_th: row.label_th,
      sort_order: Number(row.sort_order),
    })),
  };
}
