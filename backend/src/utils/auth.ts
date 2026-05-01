// backend/src/utils/auth.ts
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";

/**
 * โครงข้อมูล user ที่เราจะฝังไว้ใน JWT
 * - admin/exec อาจไม่มี departmentId (null)
 * - dept_head/staff ต้องมี departmentId
 */
export type JwtUser = {
  id: number;
  username: string;
  role: "admin" | "exec" | "dept_head" | "staff";
  departmentId: number | null;
};

export type UserRole = JwtUser["role"];

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "dev_secret_change_me",
);

/** hash รหัสผ่านก่อนเก็บลง DB */
export async function hashPassword(plain: string) {
  return bcrypt.hash(plain, 10);
}

/** เทียบรหัสผ่านตอน login */
export async function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

/** สร้าง token */
export async function signToken(user: JwtUser) {
  return await new SignJWT({
    id: user.id,
    username: user.username,
    role: user.role,
    departmentId: user.departmentId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET);
}

/** ตรวจ token */
export async function verifyToken(token: string): Promise<JwtUser> {
  const { payload } = await jwtVerify(token, JWT_SECRET);

  return {
    id: Number(payload.id),
    username: String(payload.username ?? ""),
    role: payload.role as UserRole,
    departmentId:
      payload.departmentId === null || payload.departmentId === undefined
        ? null
        : Number(payload.departmentId),
  };
}

export function getBearerToken(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

export async function authenticateRequest(request: Request) {
  const token = getBearerToken(request);
  if (!token) {
    throw new Error("Missing Authorization Bearer token");
  }

  return await verifyToken(token);
}
