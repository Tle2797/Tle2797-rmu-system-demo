// backend/src/routes/admin.qrcodes.ts
import { Elysia, t } from "elysia";
import { db } from "../config/db";
import QRCode from "qrcode";
import path from "path";
import fs from "fs";

/**
 * Admin QR Codes Route
 * prefix: /api/admin/qrcodes
 *
 * Endpoints:
 * - GET  /             → list departments พร้อมสถานะ QR code (+ central QR status)
 * - POST /generate     → สร้าง/รีเซต QR code (central หรือ department)
 * - GET  /download/:id → ดาวน์โหลด QR code เป็น PNG
 */

// ========== Config ==========
const BASE_URL =
  process.env.SURVEY_BASE_URL || "http://localhost:3000";

// โฟลเดอร์เก็บไฟล์ QR (สัมพัทธ์จาก root ของ backend)
const QR_DIR = path.resolve(process.cwd(), "public", "qrcodes");

// สร้างโฟลเดอร์ถ้ายังไม่มี
if (!fs.existsSync(QR_DIR)) {
  fs.mkdirSync(QR_DIR, { recursive: true });
}

// ========== Helper ==========
/**
 * สร้างไฟล์ PNG ของ QR Code และบันทึกลงดิสก์
 * @returns path ของไฟล์ที่บันทึก (สำหรับส่งให้ client download)
 */
async function generateQRFile(
  filename: string,
  url: string
): Promise<string> {
  const filePath = path.join(QR_DIR, filename);
  await QRCode.toFile(filePath, url, {
    type: "png",
    width: 512,
    margin: 2,
    color: {
      dark: "#1e3a5f",
      light: "#ffffff",
    },
  });
  return filePath;
}

export const adminQRCodesRoute = new Elysia({ prefix: "/api/admin/qrcodes" })

  /**
   * =============================================
   * GET /api/admin/qrcodes
   * =============================================
   * คืน:
   * - central: ข้อมูล QR กลาง (มีหรือยัง)
   * - departments: รายการหน่วยงานทั้งหมดพร้อมสถานะ QR
   * - stats: สรุปจำนวน
   */
  .get("/", async () => {
    // 1) QR กลาง
    const centralRes = await db.query(
      `SELECT id, image_path, link_target, created_at
       FROM qrcodes
       WHERE type = 'central'
       LIMIT 1`
    );
    const central = centralRes.rows[0] ?? null;

    // 2) รายการหน่วยงานพร้อม QR status
    const deptRes = await db.query(
      `SELECT
         d.id,
         d.name,
         d.is_active,
         q.id       AS qrcode_id,
         q.image_path,
         q.link_target,
         q.created_at AS qr_created_at
       FROM departments d
       LEFT JOIN qrcodes q
         ON q.department_id = d.id
        AND q.type = 'department'
       ORDER BY d.created_at DESC, d.id DESC`
    );

    const departments = deptRes.rows;

    // 3) stats
    const total = departments.length;
    const hasQr = departments.filter((d) => !!d.qrcode_id).length;
    const noQr = total - hasQr;

    return {
      central,
      departments,
      stats: {
        total,
        has_qr: hasQr,
        no_qr: noQr,
        central_ready: !!central,
      },
    };
  })

  /**
   * =============================================
   * POST /api/admin/qrcodes/generate
   * =============================================
   * body:
   *   { type: "central" }
   *   { type: "department", department_id: number }
   *
   * - สร้างหรือ reset QR code
   * - บันทึกไฟล์ PNG ลงดิสก์
   * - upsert ข้อมูลลงตาราง qrcodes
   */
  .post(
    "/generate",
    async ({ body, set }) => {
      // รับ body แบบ any แล้ว validate เอง เพื่อหลีกเลี่ยงปัญหา 422 จาก TypeBox strict
      const b = body as any;
      const type: string = b?.type ?? "";

      if (type === "central") {
        const link = `${BASE_URL}/survey`;
        const filename = `central.png`;
        await generateQRFile(filename, link);
        const imagePath = `/qrcodes/${filename}`;

        // upsert — ถ้า table มี unique index on (type) WHERE type='central'
        // ใช้ fallback: ลบแล้ว insert ใหม่แทน ON CONFLICT เพื่อ compatibility
        await db.query(
          `DELETE FROM qrcodes WHERE type = 'central'`
        );
        await db.query(
          `INSERT INTO qrcodes (type, department_id, image_path, link_target, is_active)
           VALUES ('central', NULL, $1, $2, true)`,
          [imagePath, link]
        );

        const row = await db.query(
          `SELECT id, type, image_path, link_target, created_at FROM qrcodes WHERE type = 'central' LIMIT 1`
        );
        return { message: "QR Code กลางสร้างสำเร็จ", qrcode: row.rows[0] };
      }

      if (type === "department") {
        const deptId = Number(b?.department_id);
        if (!Number.isFinite(deptId) || deptId <= 0) {
          set.status = 400;
          return { message: "department_id is required" };
        }

        const deptRes = await db.query(
          `SELECT id, name FROM departments WHERE id = $1`,
          [deptId]
        );
        if ((deptRes.rowCount ?? 0) === 0) {
          set.status = 404;
          return { message: "Department not found" };
        }

        const link = `${BASE_URL}/survey/${deptId}`;
        const filename = `dept_${deptId}.png`;
        await generateQRFile(filename, link);
        const imagePath = `/qrcodes/${filename}`;

        // upsert: ลบ QR เดิมของ dept นี้แล้ว insert ใหม่
        await db.query(
          `DELETE FROM qrcodes WHERE type = 'department' AND department_id = $1`,
          [deptId]
        );
        await db.query(
          `INSERT INTO qrcodes (type, department_id, image_path, link_target, is_active)
           VALUES ('department', $1, $2, $3, true)`,
          [deptId, imagePath, link]
        );

        const row = await db.query(
          `SELECT id, type, department_id, image_path, link_target, created_at
           FROM qrcodes WHERE type = 'department' AND department_id = $1 LIMIT 1`,
          [deptId]
        );
        return { message: "QR Code หน่วยงานสร้างสำเร็จ", qrcode: row.rows[0] };
      }

      set.status = 400;
      return { message: "type must be 'central' or 'department'" };
    },
    {
      // รับ body แบบ loose ป้องกัน 422 จาก TypeBox
      body: t.Object(
        {
          type: t.String(),
          department_id: t.Optional(t.Union([t.Number(), t.String()])),
        },
        { additionalProperties: true }
      ),
    }
  )

  /**
   * =============================================
   * GET /api/admin/qrcodes/download/:id
   * =============================================
   * ดาวน์โหลดไฟล์ QR code PNG โดยตรง
   * โดยใช้ qrcode id จากตาราง qrcodes
   */
  .get("/download/:id", async ({ params, set }) => {
    const id = Number(params.id);
    if (!Number.isFinite(id) || id <= 0) {
      set.status = 400;
      return { message: "Invalid id" };
    }

    const res = await db.query(
      `SELECT image_path, type, department_id FROM qrcodes WHERE id = $1 LIMIT 1`,
      [id]
    );

    if (res.rowCount === 0) {
      set.status = 404;
      return { message: "QR code not found" };
    }

    const { image_path, type, department_id } = res.rows[0];

    // สร้าง filename สำหรับ download
    const downloadName =
      type === "central" ? "qr_central.png" : `qr_dept_${department_id}.png`;

    // image_path = "/qrcodes/central.png" → แปลงเป็น path จริง
    const filePath = path.resolve(
      process.cwd(),
      "public",
      image_path.replace(/^\//, "")
    );

    if (!fs.existsSync(filePath)) {
      set.status = 404;
      return { message: "File not found on disk" };
    }

    const fileBuffer = fs.readFileSync(filePath);
    const base64 = fileBuffer.toString("base64");

    return {
      filename: downloadName,
      content_type: "image/png",
      data: base64, // ส่ง base64 ให้ client แปลงเป็น Blob แล้ว download
    };
  });
