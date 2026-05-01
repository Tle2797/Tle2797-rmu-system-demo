import bcrypt from "bcryptjs";
import { db } from "../config/db";
import {
  ProfileImageUploadError,
  saveProfileImage,
} from "../services/profile-image";

export async function listUsers() {
  const res = await db.query(
    `
    SELECT
      u.id,
      u.username,
      u.email,
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
}

export async function createUser({ body, set }: any) {
  const username = body.username.trim();
  const role = body.role;
  const department_id = body.department_id ?? null;
  const password = body.password;
  const title = body.title ? body.title.trim() : null;
  const first_name = body.first_name ? body.first_name.trim() : null;
  const last_name = body.last_name ? body.last_name.trim() : null;
  const email = body.email ? String(body.email).trim().toLowerCase() : null;

  if (!username) {
    set.status = 400;
    return { message: "กรุณากรอกชื่อผู้ใช้" };
  }
  if (!password || password.length < 8) {
    set.status = 400;
    return { message: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร" };
  }

  if ((role === "dept_head" || role === "staff") && !department_id) {
    set.status = 400;
    return { message: "กรุณาเลือกหน่วยงานสำหรับตำแหน่งนี้" };
  }

  const dup = await db.query(
    `SELECT 1 FROM users WHERE username = $1 LIMIT 1`,
    [username],
  );
  if ((dup.rowCount ?? 0) > 0) {
    set.status = 409;
    return { message: "ชื่อผู้ใช้นี้มีอยู่ในระบบแล้ว" };
  }

  if (email) {
    const dupEmail = await db.query(
      `SELECT 1 FROM users WHERE lower(email) = $1 LIMIT 1`,
      [email],
    );
    if ((dupEmail.rowCount ?? 0) > 0) {
      set.status = 409;
      return { message: "อีเมลนี้มีอยู่ในระบบแล้ว" };
    }
  }

  const password_hash = await bcrypt.hash(password, 10);

  const ins = await db.query(
    `
    INSERT INTO users (username, password_hash, role, department_id, is_active, title, first_name, last_name, email)
    VALUES ($1, $2, $3, $4, true, $5, $6, $7, $8)
    RETURNING id, username, email, role, department_id, is_active, title, first_name, last_name, profile_image_url, updated_at
    `,
    [username, password_hash, role, department_id, title, first_name, last_name, email],
  );

  set.status = 201;
  return { item: ins.rows[0] };
}

export async function updateUser({ params, body, set }: any) {
  const id = Number(params.id);
  if (!Number.isFinite(id) || id <= 0) {
    set.status = 400;
    return { message: "รหัสผู้ใช้ไม่ถูกต้อง" };
  }

  const existed = await db.query(`SELECT * FROM users WHERE id = $1`, [id]);
  if (existed.rowCount === 0) {
    set.status = 404;
    return { message: "ไม่พบข้อมูลผู้ใช้" };
  }

  const current = existed.rows[0] as {
    id: number;
    username: string;
    email: string | null;
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
      RETURNING id, username, email, role, department_id, is_active, title, first_name, last_name, profile_image_url, updated_at
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
  const email =
    body.email !== undefined
      ? body.email
        ? String(body.email).trim().toLowerCase()
        : null
      : current.email;

  const department_id =
    body.department_id === undefined
      ? current.department_id
      : body.department_id;

  if ((role === "dept_head" || role === "staff") && !department_id) {
    set.status = 400;
    return { message: "กรุณาเลือกหน่วยงานสำหรับตำแหน่งนี้" };
  }

  if (username !== current.username) {
    const dup = await db.query(
      `SELECT 1 FROM users WHERE username = $1 AND id <> $2 LIMIT 1`,
      [username, id],
    );
    if ((dup.rowCount ?? 0) > 0) {
      set.status = 409;
      return { message: "ชื่อผู้ใช้นี้มีอยู่ในระบบแล้ว" };
    }
  }

  if (email) {
    const dupEmail = await db.query(
      `SELECT 1 FROM users WHERE lower(email) = $1 AND id <> $2 LIMIT 1`,
      [email, id],
    );
    if ((dupEmail.rowCount ?? 0) > 0) {
      set.status = 409;
      return { message: "อีเมลนี้มีอยู่ในระบบแล้ว" };
    }
  }

  if (body.password !== undefined) {
    const pw = body.password;
    if (!pw || pw.length < 8) {
      set.status = 400;
      return { message: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร" };
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
          email = $9,
          updated_at = NOW()
      WHERE id = $1
      RETURNING id, username, email, role, department_id, is_active, title, first_name, last_name, profile_image_url, updated_at
      `,
      [id, username, role, department_id, password_hash, title, first_name, last_name, email],
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
        email = $8,
        updated_at = NOW()
    WHERE id = $1
    RETURNING id, username, email, role, department_id, is_active, title, first_name, last_name, profile_image_url, updated_at
    `,
    [id, username, role, department_id, title, first_name, last_name, email],
  );

  return { item: up.rows[0] };
}

export async function deleteUser({ params, set }: any) {
  const id = Number(params.id);
  if (!Number.isFinite(id) || id <= 0) {
    set.status = 400;
    return { message: "รหัสผู้ใช้ไม่ถูกต้อง" };
  }

  try {
    const del = await db.query(
      `DELETE FROM users WHERE id = $1 RETURNING id`,
      [id]
    );

    if ((del.rowCount ?? 0) === 0) {
      set.status = 404;
      return { message: "ไม่พบข้อมูลผู้ใช้" };
    }

    return { message: "ลบผู้ใช้เรียบร้อยแล้ว" };
  } catch (err: any) {
    if (err.code === "23503") {
      set.status = 400;
      return { message: "เนเธกเนเธชเธฒเธกเธฒเธฃเธ–เธฅเธเธเธนเนเนเธเนเธเธตเนเนเธ”เน เน€เธเธทเนเธญเธเธเธฒเธเธกเธตเธเนเธญเธกเธนเธฅเธเธนเธเธญเธขเธนเน" };
    }
    throw err;
  }
}

export async function updateAdminProfile({ body, set }: any) {
  const b = body as any;
  const userId = Number(b?.user_id);
  if (!Number.isFinite(userId) || userId <= 0) {
    set.status = 400;
    return { message: "กรุณาระบุผู้ใช้" };
  }

  const existed = await db.query(`SELECT * FROM users WHERE id = $1`, [userId]);
  if ((existed.rowCount ?? 0) === 0) {
    set.status = 404;
    return { message: "ไม่พบข้อมูลผู้ใช้" };
  }
  const current = existed.rows[0];

  const username = (b?.username ?? current.username).trim();
  const title = b?.title !== undefined ? (b.title ? b.title.trim() : null) : current.title;
  const first_name = b?.first_name !== undefined ? (b.first_name ? b.first_name.trim() : null) : current.first_name;
  const last_name = b?.last_name !== undefined ? (b.last_name ? b.last_name.trim() : null) : current.last_name;

  if (!username) {
    set.status = 400;
    return { message: "กรุณากรอกชื่อผู้ใช้" };
  }

  const dup = await db.query(
    `SELECT 1 FROM users WHERE username = $1 AND id <> $2 LIMIT 1`,
    [username, userId],
  );
  if ((dup.rowCount ?? 0) > 0) {
    set.status = 409;
    return { message: "ชื่อผู้ใช้นี้มีอยู่ในระบบแล้ว" };
  }

  if (b?.password !== undefined && b?.password !== "") {
    const pw = String(b.password);
    if (pw.length < 8) {
      set.status = 400;
      return { message: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร" };
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
}

export async function uploadAdminProfileImage({ request, set }: any) {
  const formData = await request.formData();
  const userId = Number(formData.get("user_id"));

  if (!Number.isFinite(userId) || userId <= 0) {
    set.status = 400;
    return { message: "กรุณาระบุผู้ใช้" };
  }

  const userRes = await db.query(`SELECT id FROM users WHERE id = $1`, [userId]);
  if ((userRes.rowCount ?? 0) === 0) {
    set.status = 404;
    return { message: "ไม่พบข้อมูลผู้ใช้" };
  }

  let profile_image_url: string;
  try {
    const savedImage = await saveProfileImage(userId, formData.get("image"));
    profile_image_url = savedImage.profile_image_url;
  } catch (error) {
    if (error instanceof ProfileImageUploadError) {
      set.status = error.status;
      return error.body;
    }
    throw error;
  }

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
}
