// backend/scripst/hash.ts
import bcrypt from "bcryptjs";

/**
 * ใช้สร้าง password_hash สำหรับใส่ใน DB
 * ตัวอย่าง:
 * bun run backend/scripts/hash.ts "admin1234"
 */
const pw = process.argv[2] || "admin1234";
const hash = await bcrypt.hash(pw, 10);
console.log(hash);
