import { db } from "../src/config/db";

async function verify() {
  try {
    const res = await db.query(`
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'responses'::regclass
        AND conname = 'uq_one_response_per_slot';
    `);
    
    if (res.rowCount === 0) {
      console.log("CONSTRAINT_IS_REMOVED");
    } else {
      console.log("CONSTRAINT_STILL_EXISTS");
    }
  } catch (err) {
    console.error("DB Error:", err);
  } finally {
    process.exit(0);
  }
}

verify();
