import { db } from "../config/db";

export type ActiveSurvey = {
  id: number;
  title: string | null;
  year_be: number | null;
  starts_at: string | null;
  ends_at: string | null;
};

export async function getActiveSurvey(): Promise<ActiveSurvey | null> {
  const res = await db.query(
    `
    SELECT id, title, year_be, starts_at, ends_at
    FROM surveys
    WHERE is_active = true
    ORDER BY updated_at DESC NULLS LAST, year_be DESC, id DESC
    LIMIT 1
    `,
  );

  if ((res.rowCount ?? 0) === 0) {
    return null;
  }

  const row = res.rows[0];
  return {
    id: Number(row.id),
    title: row.title ?? null,
    year_be: row.year_be !== null && row.year_be !== undefined ? Number(row.year_be) : null,
    starts_at: row.starts_at ? String(row.starts_at) : null,
    ends_at: row.ends_at ? String(row.ends_at) : null,
  };
}
