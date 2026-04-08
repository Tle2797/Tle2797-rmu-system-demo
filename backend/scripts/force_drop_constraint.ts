import { db } from "../src/config/db";

async function run() {
  try {
    const res = await db.query(`
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'responses'::regclass;
    `);
    console.log("Constraints on responses table:");
    res.rows.forEach(r => console.log(r.conname));

    console.log("Attempting to drop uq_one_response_per_slot...");
    await db.query(`ALTER TABLE responses DROP CONSTRAINT IF EXISTS uq_one_response_per_slot;`);
    console.log("Dropped.");

    const res2 = await db.query(`
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'responses'::regclass;
    `);
    console.log("Constraints after drop:");
    res2.rows.forEach(r => console.log(r.conname));

  } catch (err) {
    console.error("DB Error:", err);
  } finally {
    process.exit(0);
  }
}

run();
