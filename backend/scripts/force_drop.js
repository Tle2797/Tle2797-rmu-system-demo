const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

async function dropConstraint() {
  try {
    const res1 = await pool.query(`
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'responses'::regclass;
    `);
    console.log("Constraints before:");
    console.log(res1.rows.map(r => r.conname));

    await pool.query(`ALTER TABLE responses DROP CONSTRAINT IF EXISTS uq_one_response_per_slot;`);
    console.log("DROP CONSTRAINT EXECUTED");

    const res2 = await pool.query(`
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'responses'::regclass;
    `);
    console.log("Constraints after:");
    console.log(res2.rows.map(r => r.conname));
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
dropConstraint();
