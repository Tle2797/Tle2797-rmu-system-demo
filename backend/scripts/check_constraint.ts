import { db } from "../src/config/db";

async function checkConstraint() {
  try {
    const res = await db.query(`
      SELECT
        con.conname AS constraint_name,
        pg_get_constraintdef(con.oid) AS constraint_definition
      FROM pg_constraint con
      INNER JOIN pg_class rel 
        ON rel.oid = con.conrelid
      INNER JOIN pg_namespace nsp 
        ON nsp.oid = connamespace
      WHERE nsp.nspname = 'public' 
        AND rel.relname = 'responses';
    `);
    
    console.log("CONSTRAINTS ON RESPONSES:");
    res.rows.forEach(r => {
      console.log(`- ${r.constraint_name}: ${r.constraint_definition}`);
    });
  } catch (err) {
    console.error("Error checking constraints:", err);
  } finally {
    process.exit(0);
  }
}

checkConstraint();
