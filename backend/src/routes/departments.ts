// backend/src/routes/departments.ts
import { Elysia } from "elysia";
import { db } from "../config/db";

/**
 * Route นี้ดูแลเรื่อง "หน่วยงาน"
 * prefix = /api/departments
 */
export const departmentsRoute = new Elysia({
  prefix: "/api/departments",
})

  /**
   * GET /api/departments
   * ใช้ดึงรายชื่อหน่วยงานทั้งหมด (เฉพาะที่ active)
   */
  .get("/", async () => {
    /**
     * SQL Query:
     * - SELECT id, name -> เอาเฉพาะข้อมูลที่จำเป็น
     * - FROM departments -> จากตารางหน่วยงาน
     * - WHERE is_active = true -> เอาเฉพาะหน่วยงานที่เปิดใช้งาน
     * - ORDER BY id ASC -> เรียงลำดับจากเก่าไปใหม่
     */
    const sql = `
      SELECT
        id,
        name
      FROM departments
      WHERE is_active = true
      ORDER BY id ASC
    `;

    // ส่ง SQL ไปให้ PostgreSQL ทำงาน
    const result = await db.query(sql);

    // result.rows คือ array ของข้อมูลที่ได้รับจากฐานข้อมูล
    return {
      total: result.rowCount, // จำนวนหน่วยงาน
      items: result.rows, // รายการหน่วยงาน
    };
  })

 /**
 * GET /api/departments/:id
 * ใช้ดึงข้อมูลหน่วยงาน 1 หน่วยงาน
 */
  .get("/:id", async ({ params, set }) => {
    const departmentId = Number(params.id);
    
    // ป้องกัน id กรณีไม่ใช่ตัวเลข
    if(Number.isNaN(departmentId)) {
        set.status = 400;
        return { message: "Invalid department id"};
    }

    // เลือก
    const sql = `
      SELECT 
        d.id,
        d.name,
        d.is_active,
        q.id as qrcode_id,
        q.image_path,
        q.link_target
      FROM departments d
      LEFT JOIN qrcodes q ON q.department_id = d.id AND q.type = 'department'
      WHERE d.id = $1
      AND d.is_active = true
    `;

    const result = await db.query(sql, [departmentId])

    // ถ้าไม่พบข้อมูล
    if (result.rowCount === 0) {
        set.status = 404;
        return { message: "Department not found" };
    }

    // result.rows คือ array ของข้อมูลที่ได้จากฐานข้อมูล
    // ห่อ object ใน { department: ... } เพื่อให้ตรงกับที่ client คาดหวัง
    return { department: result.rows[0] };
  });
