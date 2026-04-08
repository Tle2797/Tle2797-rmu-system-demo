import { Elysia } from "elysia";
import { db } from "../config/db";
import fs from "fs";
import path from "path";
import {
  authenticateRequest,
  hashPassword,
  signToken,
  verifyPassword,
  verifyToken,
  type JwtUser,
} from "../utils/auth";

export const authRoute = new Elysia({ prefix: "/api/auth" })
  .post("/login", async ({ body, set }) => {
    const payload = body as any;
    const username = String(payload?.username || "").trim();
    const password = String(payload?.password || "");

    if (!username || !password) {
      set.status = 400;
      return { message: "username/password is required" };
    }

    const userRes = await db.query(
      `
      SELECT id, username, password_hash, role, department_id, is_active
      FROM users
      WHERE username = $1
      LIMIT 1
      `,
      [username],
    );

    if (userRes.rowCount === 0) {
      set.status = 401;
      return { message: "Invalid credentials" };
    }

    const u = userRes.rows[0];

    if (!u.is_active) {
      set.status = 403;
      return { message: "User is inactive" };
    }

    const ok = await verifyPassword(password, u.password_hash);
    if (!ok) {
      set.status = 401;
      return { message: "Invalid credentials" };
    }

    const role = u.role as JwtUser["role"];
    const departmentId = u.department_id === null ? null : Number(u.department_id);

    if ((role === "dept_head" || role === "staff") && !departmentId) {
      set.status = 409;
      return { message: "User role requires department_id but it's missing" };
    }

    await db.query(`UPDATE users SET last_login_at = now() WHERE id = $1`, [u.id]);

    const jwtUser: JwtUser = {
      id: Number(u.id),
      username: String(u.username),
      role,
      departmentId,
    };

    const token = await signToken(jwtUser);

    return {
      token,
      user: jwtUser,
    };
  })
  .get("/me", async ({ request, set }) => {
    const auth = request.headers.get("authorization") || "";
    const match = auth.match(/^Bearer\s+(.+)$/i);

    if (!match || !match[1]) {
      set.status = 401;
      return { message: "Missing Authorization Bearer token" };
    }

    try {
      const token = match[1];
      const decoded = await verifyToken(token);

      const dbUserRes = await db.query(
        `
        SELECT id, username, role, department_id, is_active, title, first_name, last_name, profile_image_url, created_at, updated_at
        FROM users
        WHERE id = $1
        LIMIT 1
        `,
        [decoded.id],
      );

      if (dbUserRes.rowCount === 0) {
        set.status = 401;
        return { message: "User not found" };
      }

      const u = dbUserRes.rows[0];
      if (!u.is_active) {
        set.status = 403;
        return { message: "User is inactive" };
      }

      const user = {
        id: Number(u.id),
        username: String(u.username),
        role: u.role,
        departmentId: u.department_id === null ? null : Number(u.department_id),
        title: u.title,
        first_name: u.first_name,
        last_name: u.last_name,
        profile_image_url: u.profile_image_url,
        created_at: u.created_at,
        updated_at: u.updated_at,
        is_active: u.is_active,
      };

      return { user };
    } catch {
      set.status = 401;
      return { message: "Invalid token" };
    }
  })
  .put("/profile", async ({ request, body, set }) => {
    const currentUser = await authenticateRequest(request);
    const b = body as any;

    const username = String(b?.username ?? "").trim();
    const title = b?.title !== undefined ? (b.title ? String(b.title).trim() : null) : null;
    const first_name =
      b?.first_name !== undefined ? (b.first_name ? String(b.first_name).trim() : null) : null;
    const last_name =
      b?.last_name !== undefined ? (b.last_name ? String(b.last_name).trim() : null) : null;
    const password = b?.password !== undefined ? String(b.password ?? "") : undefined;

    if (!username) {
      set.status = 400;
      return { message: "username is required" };
    }

    const existed = await db.query(`SELECT * FROM users WHERE id = $1`, [currentUser.id]);
    if ((existed.rowCount ?? 0) === 0) {
      set.status = 404;
      return { message: "User not found" };
    }

    const dup = await db.query(
      `SELECT 1 FROM users WHERE username = $1 AND id <> $2 LIMIT 1`,
      [username, currentUser.id],
    );
    if ((dup.rowCount ?? 0) > 0) {
      set.status = 409;
      return { message: "username already exists" };
    }

    if (password !== undefined && password !== "") {
      if (password.length < 8) {
        set.status = 400;
        return { message: "password must be at least 8 characters" };
      }

      const password_hash = await hashPassword(password);
      const up = await db.query(
        `UPDATE users
         SET username = $2,
             password_hash = $3,
             title = $4,
             first_name = $5,
             last_name = $6,
             updated_at = NOW()
         WHERE id = $1
         RETURNING id, username, role, department_id, is_active, title, first_name, last_name, profile_image_url, updated_at`,
        [currentUser.id, username, password_hash, title, first_name, last_name],
      );

      return { item: up.rows[0] };
    }

    const up = await db.query(
      `UPDATE users
       SET username = $2,
           title = $3,
           first_name = $4,
           last_name = $5,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, username, role, department_id, is_active, title, first_name, last_name, profile_image_url, updated_at`,
      [currentUser.id, username, title, first_name, last_name],
    );

    return { item: up.rows[0] };
  })
  .post("/profile/image", async ({ request, set }) => {
    const currentUser = await authenticateRequest(request);
    const formData = await request.formData();

    const userRes = await db.query(`SELECT id FROM users WHERE id = $1`, [currentUser.id]);
    if ((userRes.rowCount ?? 0) === 0) {
      set.status = 404;
      return { message: "User not found" };
    }

    const fileValue = formData.get("image");
    if (
      !fileValue ||
      typeof fileValue !== "object" ||
      !("arrayBuffer" in fileValue)
    ) {
      set.status = 400;
      return { message: "image file is required" };
    }

    const file = fileValue as {
      arrayBuffer: () => Promise<ArrayBuffer>;
      name?: string;
      type?: string;
      size?: number;
    };

    const mime = String(file.type || "").toLowerCase();
    const fileName = String(file.name || "");
    const fileSize = Number(file.size || 0);

    if (fileSize > 5 * 1024 * 1024) {
      set.status = 400;
      return { message: "image file must be smaller than 5MB" };
    }

    const extFromName = path.extname(fileName).replace(/^\./, "").toLowerCase();
    const ext =
      mime === "image/jpeg" || mime === "image/jpg"
        ? "jpg"
        : mime === "image/png"
          ? "png"
          : mime === "image/webp"
            ? "webp"
            : mime === "image/gif"
              ? "gif"
              : extFromName === "jpeg"
                ? "jpg"
                : extFromName;

    if (!["jpg", "png", "webp", "gif"].includes(ext)) {
      set.status = 400;
      return { message: "Unsupported image type" };
    }

    const uploadDir = path.resolve(process.cwd(), "public", "uploads", "profiles");
    fs.mkdirSync(uploadDir, { recursive: true });

    const filename = `profile-${currentUser.id}.${ext}`;
    const targetPath = path.join(uploadDir, filename);
    const buffer = new Uint8Array(await file.arrayBuffer());

    fs.writeFileSync(targetPath, buffer);

    for (const entry of fs.readdirSync(uploadDir)) {
      if (entry.startsWith(`profile-${currentUser.id}.`) && entry !== filename) {
        try {
          fs.unlinkSync(path.join(uploadDir, entry));
        } catch {
          // Ignore unlink errors for stale files.
        }
      }
    }

    const profile_image_url = `/uploads/profiles/${filename}`;
    const up = await db.query(
      `
      UPDATE users
      SET profile_image_url = $2,
          updated_at = NOW()
      WHERE id = $1
      RETURNING profile_image_url, updated_at
      `,
      [currentUser.id, profile_image_url],
    );

    return {
      profile_image_url: up.rows[0].profile_image_url,
      updated_at: up.rows[0].updated_at,
    };
  });
