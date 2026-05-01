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
    