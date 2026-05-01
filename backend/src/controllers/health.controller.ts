import { db } from "../config/db";

export async function getHealth() {
  const result = await db.query("SELECT NOW()");
  return {
    status: "ok",
    db_time: result.rows[0].now,
  };
}
