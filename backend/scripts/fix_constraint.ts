import { db } from "../src/config/db";

async function fixConstraint() {
  console.log("Starting constraint fix...");
  try {
    // 1. Drop existing constraint
    await db.query(`ALTER TABLE responses DROP CONSTRAINT IF EXISTS uq_one_response_per_slot;`);
    console.log("Dropped old constraint.");

    // 2. Add new constraint including survey_id
    await db.query(`
      ALTER TABLE responses 
      ADD CONSTRAINT uq_one_response_per_slot 
      UNIQUE (survey_id, respondent_token_id, department_id, responded_date, slot_id);
    `);
    console.log("Added new constraint with survey_id.");

  } catch (err) {
    console.error("Error updating constraint:", err);
  } finally {
    process.exit(0);
  }
}

fixConstraint();
