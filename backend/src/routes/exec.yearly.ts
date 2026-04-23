// backend/src/routes/exec.yearly.ts
import { Elysia } from "elysia";
import { db } from "../config/db";

function getCurrentBEYear() {
  return new Date().getFullYear() + 543;
}

/**
 * Exec Yearly Route
 * prefix: /api/exec
 */
export const execYearlyRoute = new Elysia({ prefix: "/api/exec" })
  /**
   * GET /api/exec/yearly
   * ดึงข้อมูลภาพรวมรายปีตามปีแบบประเมิน (survey.year_be)
   * เพื่อให้สอดคล้องกับหน้ารายปีของหน่วยงาน และไม่ถูกรวมผิดปีจาก submitted_at
   */
  .get("/yearly", async () => {
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

    return {
      years_list: yearsBE,
      yearly_overview: yearlyOverview,
      rating_bands: ratingBandsRes.rows.map((row) => ({
        id: Number(row.id),
        min_value: Number(row.min_value),
        max_value: Number(row.max_value),
        label_th: row.label_th,
        sort_order: Number(row.sort_order),
      })),
    };
  });
