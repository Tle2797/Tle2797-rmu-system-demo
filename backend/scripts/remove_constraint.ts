import { db } from "../src/config/db";

async function removeConstraint() {
  console.log("Removing unique constraint to allow max_attempts > 1...");
  try {
    await db.query(`ALTER TABLE responses DROP CONSTRAINT IF EXISTS uq_one_response_per_slot;`);
    console.log("Dropped constraint uq_one_response_per_slot.");
  } catch (err) {
    console.error("Error removing constraint:", err);
  } finally {
    process.exit(0);
  }
}

removeConstraint();
