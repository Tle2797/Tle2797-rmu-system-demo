// backend/src/routes/admin.users.ts
import { Elysia, t } from "elysia";
import { db } from "../config/db";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";

/**
 * Admin Users Routes
 * prefix: /api/admin
 */
export const adminUsersRoute = new Elysia({ prefix: "/api/admin" })

  /**
   * GET /api/admin/users
   */
  .get("/users", async ({ set }) => {
    const res = await db.query(
      `
      SELECT
        u.id,
        u.username,
        u.role,
        u.department_id,
        u.is_active,
        u.title,
        u.first_name,
        u.last_name,
        u.profile_image_url,
        u.updated_at,
        u.created_at,
        d.name AS department_name
      FROM users u
      LEFT JOIN departments d ON d.id = u.department_id
      ORDER BY u.created_at DESC, u.id DESC
      `,
    );

    return {
      total: res.rowCount,
      items: res.rows,
    };
  })

  /**
   * POST /api/admin/users
   * body: { username, role, department_id?, password }
   */
  .post(
    "/users",
    async ({ body, set }) => {
      const username = body.username.trim();
      const role = body.role;
      const department_id = body.department_id ?? null;
      const password = body.password;
      const title = body.title ? body.title.trim() : null;
      const first_name = body.first_name ? body.first_name.trim() : null;
      const last_name = body.last_name ? body.last_name.trim() : null;

      if (!username) {
        set.status = 400;
        return { message: "username is required" };
      }
      if (!password || password.length < 8) {
        set.status = 400;
        return { message: "password must be at least 8 characters" };
      }

      if ((role === "dept_head" || role === "staff") && !department_id) {
        set.status = 400;
        return { message: "department_id is required for dept_head/staff" };
      }

      const dup = await db.query(
        `SELECT 1 FROM users WHERE username = $1 LIMIT 1`,
        [username],
      );
      if ((dup.rowCount ?? 0) > 0) {
        set.status = 409;
        return { message: "username already exists" };
      }

      const password_hash = await bcrypt.hash(password, 10);

      const ins = await db.query(
        `
        INSERT INTO users (username, password_hash, role, department_id, is_active, title, first_name, last_name)
        VALUES ($1, $2, $3, $4, true, $5, $6, $7)
        RETURNING id, username, role, department_id, is_active, title, first_name, last_name, profile_image_url, updated_at
        `,
        [username, password_hash, role, department_id, title, first_name, last_name],
      );

      set.status = 201;
      return { item: ins.rows[0] };
    },
    {
      body: t.Object({
        username: t.String(),
        role: t.Union([
          t.Literal("admin"),
          t.Literal("exec"),
          t.Literal("dept_head"),
          t.Literal("staff"),
        ]),
        department_id: t.Optional(t.Union([t.Number(), t.Null()])),
        password: t.String(),
        title: t.Optional(t.Union([t.String(), t.Null()])),
        first_name: t.Optional(t.Union([t.String(), t.Null()])),
        last_name: t.Optional(t.Union([t.String(), t.Null()])),
      }),
    },
  )

  /**
   * PUT /api/admin/users/:id
   */
  .put(
    "/users/:id",
    async ({ params, body, set }) => {
      const id = Number(params.id);
      if (!Number.isFinite(id) || id <= 0) {
        set.status = 400;
        return { message: "Invalid user id" };
      }

      const existed = await db.query(`SELECT * FROM users WHERE id = $1`, [id]);
      if (existed.rowCount === 0) {
        set.status = 404;
        return { message: "User not found" };
      }

      const current = existed.rows[0] as {
        id: number;
        username: string;
        role: "admin" | "exec" | "dept_head" | "staff";
        department_id: number | null;
        is_active: boolean;
      };

      if (typeof body.is_active === "boolean") {
        const up = await db.query(
          `
          UPDATE users
          SET is_active = $2,
              updated_at = NOW()
          WHERE id = $1
          RETURNING id, username, role, department_id, is_active, title, first_name, last_name, profile_image_url, updated_at
          `,
          [id, body.is_active],
        );
        return { item: up.rows[0] };
      }

      const username = (body.username ?? current.username).trim();
      const role = (body.role ?? current.role) as typeof current.role;
      const title = body.title !== undefined ? (body.title ? body.title.trim() : null) : (current as any).title;
      const first_name = body.first_name !== undefined ? (body.first_name ? body.first_name.trim() : null) : (current as any).first_name;
      const last_name = body.last_name !== undefined ? (body.last_name ? body.last_name.trim() : null) : (current as any).last_name;

      const department_id =
        body.department_id === undefined
          ? current.department_id
          : body.department_id;

      if ((role === "dept_head" || role === "staff") && !department_id) {
        set.status = 400;
        return { message: "department_id is required for dept_head/staff" };
      }

      if (username !== current.username) {
        const dup = await db.query(
          `SELECT 1 FROM users WHERE username = $1 AND id <> $2 LIMIT 1`,
          [username, id],
        );
        if ((dup.rowCount ?? 0) > 0) {
          set.status = 409;
          return { message: "username already exists" };
        }
      }

      if (body.password !== undefined) {
        const pw = body.password;
        if (!pw || pw.length < 8) {
          set.status = 400;
          return { message: "password must be at least 8 characters" };
        }
        const password_hash = await bcrypt.hash(pw, 10);

        const up = await db.query(
          `
          UPDATE users
          SET username = $2,
              role = $3,
              department_id = $4,
              password_hash = $5,
              title = $6,
              first_name = $7,
              last_name = $8,
              updated_at = NOW()
          WHERE id = $1
          RETURNING id, username, role, department_id, is_active, title, first_name, last_name, profile_image_url, updated_at
          `,
          [id, username, role, department_id, password_hash, title, first_name, last_name],
        );
        return { item: up.rows[0] };
      }

      const up = await db.query(
        `
        UPDATE users
        SET username = $2,
            role = $3,
            department_id = $4,
            title = $5,
            first_name = $6,
            last_name = $7,
            updated_at = NOW()
        WHERE id = $1
        RETURNING id, username, role, department_id, is_active, title, first_name, last_name, profile_image_url, updated_at
        `,
        [id, username, role, department_id, title, first_name, last_name],
      );

      return { item: up.rows[0] };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Partial(
        t.Object({
          username: t.String(),
          role: t.Union([
            t.Literal("admin"),
            t.Literal("exec"),
            t.Literal("dept_head"),
            t.Literal("staff"),
          ]),
          department_id: t.Union([t.Number(), t.Null()]),
          password: t.String(),
          is_active: t.Boolean(),
          title: t.Union([t.String(), t.Null()]),
          first_name: t.Union([t.String(), t.Null()]),
          last_name: t.Union([t.String(), t.Null()]),
        }),
      ),
    },
  )

  /**
   * DELETE /api/admin/users/:id
   * - ลบผู้ใช้
   */
  .delete(
    "/users/:id",
    async ({ params, set }) => {
      const id = Number(params.id);
      if (!Number.isFinite(id) || id <= 0) {
        set.status = 400;
        return { message: "Invalid user id" };
      }

      try {
        const del = await db.query(
          `DELETE FROM users WHERE id = $1 RETURNING id`,
          [id]
        );

        if ((del.rowCount ?? 0) === 0) {
          set.status = 404;
          return { message: "User not found" };
        }

        return { message: "Deleted successfully" };
      } catch (err: any) {
        if (err.code === "23503") {
          set.status = 400;
          return { message: "ไม่สามารถลบผู้ใช้นี้ได้ เนื่องจากมีข้อมูลผูกอยู่" };
        }
        throw err;
      }
    },
    { params: t.Object({ id: t.String() }) }
  )

  /**
   * PUT /api/admin/profile
   */
  .put(
    "/profile",
    async ({ body, set }) => {
      const b = body as any;
      const userId = Number(b?.user_id);
      if (!Number.isFinite(userId) || userId <= 0) {
        set.status = 400;
        return { message: "user_id is required" };
      }

      const existed = await db.query(`SELECT * FROM users WHERE id = $1`, [userId]);
      if ((existed.rowCount ?? 0) === 0) {
        set.status = 404;
        return { message: "User not found" };
      }
      const current = existed.rows[0];

      const username = (b?.username ?? current.username).trim();
      const title = b?.title !== undefined ? (b.title ? b.title.trim() : null) : current.title;
      const first_name = b?.first_name !== undefined ? (b.first_name ? b.first_name.trim() : null) : current.first_name;
      const last_name = b?.last_name !== undefined ? (b.last_name ? b.last_name.trim() : null) : current.last_name;

      if (!username) {
        set.status = 400;
        return { message: "username is required" };
      }

      const dup = await db.query(
        `SELECT 1 FROM users WHERE username = $1 AND id <> $2 LIMIT 1`,
        [username, userId],
      );
      if ((dup.rowCount ?? 0) > 0) {
        set.status = 409;
        return { message: "username already exists" };
      }

      if (b?.password !== undefined && b?.password !== "") {
        const pw = String(b.password);
        if (pw.length < 8) {
          set.status = 400;
          return { message: "password must be at least 8 characters" };
        }
        const password_hash = await bcrypt.hash(pw, 10);
        const up = await db.query(
          `UPDATE users
           SET username = $2, password_hash = $3, title = $4, first_name = $5, last_name = $6, updated_at = NOW()
           WHERE id = $1
           RETURNING id, username, role, department_id, is_active, title, first_name, last_name, profile_image_url, updated_at`,
          [userId, username, password_hash, title, first_name, last_name],
        );
        return { item: up.rows[0] };
      }

      const up = await db.query(
        `UPDATE users
         SET username = $2, title = $3, first_name = $4, last_name = $5, updated_at = NOW()
         WHERE id = $1
         RETURNING id, username, role, department_id, is_active, title, first_name, last_name, profile_image_url, updated_at`,
        [userId, username, title, first_name, last_name],
      );
      return { item: up.rows[0] };
    },
    {
      body: t.Object(
        {
          user_id: t.Number(),
          username: t.String(),
          password: t.Optional(t.String()),
          title: t.Optional(t.Union([t.String(), t.Null()])),
          first_name: t.Optional(t.Union([t.String(), t.Null()])),
          last_name: t.Optional(t.Union([t.String(), t.Null()])),
        },
        { additionalProperties: true },
      ),
    },
  )

  /**
   * POST /api/admin/profile/image
   */
  .post("/profile/image", async ({ request, set }) => {
    const formData = await request.formData();
    const userId = Number(formData.get("user_id"));

    if (!Number.isFinite(userId) || userId <= 0) {
      set.status = 400;
      return { message: "user_id is required" };
    }

    const userRes = await db.query(`SELECT id FROM users WHERE id = $1`, [userId]);
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

    const filename = `profile-${userId}.${ext}`;
    const targetPath = path.join(uploadDir, filename);
    const buffer = new Uint8Array(await file.arrayBuffer());

    fs.writeFileSync(targetPath, buffer);

    for (const entry of fs.readdirSync(uploadDir)) {
      if (entry.startsWith(`profile-${userId}.`) && entry !== filename) {
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
      [userId, profile_image_url],
    );

    return {
      profile_image_url: up.rows[0].profile_image_url,
      updated_at: up.rows[0].updated_at,
    };
  });



