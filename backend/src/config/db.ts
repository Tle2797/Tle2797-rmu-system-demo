// backend/src/config/db.ts
import {Pool} from "pg";
import "dotenv/config" ;

// สร้าง connection pool
export const db = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});

// ทดสอบการเชื่อมต่อ
db.on("connect", () => {
    console.log("✅ PostgreSQL connected");
})

db.on("error", (err) => {
    console.error("❌ PostgreSQL error", err);
})

export async function ensureUserApprovalColumns() {
    await db.query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'approved'
    `);

    await db.query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS registration_source text NOT NULL DEFAULT 'admin'
    `);

    await db.query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS approval_reviewed_by bigint
    `);

    await db.query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS approval_reviewed_at timestamp with time zone
    `);

    await db.query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS rejected_reason text
    `);

    await db.query(`
        UPDATE users
        SET approval_status = 'approved'
        WHERE approval_status IS NULL
    `);

    await db.query(`
        UPDATE users
        SET registration_source = 'admin'
        WHERE registration_source IS NULL
    `);

    await db.query(`
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conname = 'chk_users_approval_status'
            ) THEN
                ALTER TABLE users
                ADD CONSTRAINT chk_users_approval_status
                CHECK (approval_status IN ('pending', 'approved', 'rejected'));
            END IF;
        END
        $$;
    `);

    await db.query(`
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conname = 'chk_users_registration_source'
            ) THEN
                ALTER TABLE users
                ADD CONSTRAINT chk_users_registration_source
                CHECK (registration_source IN ('admin', 'self'));
            END IF;
        END
        $$;
    `);

    await db.query(`
        CREATE INDEX IF NOT EXISTS idx_users_approval_status
        ON users (approval_status)
    `);

    await db.query(`
        CREATE INDEX IF NOT EXISTS idx_users_registration_source
        ON users (registration_source)
    `);
}
