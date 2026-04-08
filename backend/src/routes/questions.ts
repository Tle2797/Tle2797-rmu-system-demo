// backend/src/routes/questions.ts
import { Elysia } from "elysia";
import { db } from "../config/db";
import { getActiveSurvey } from "../utils/surveys";

/**
 * ===============================
 * Questions Route
 * ===============================
 * Route สำหรับจัดการ "คำถามแบบประเมิน"
 * ใช้ทั้งคำถามกลาง (central) และคำถามเฉพาะหน่วยงาน (department)
 *
 * prefix: /api/questions
 */
export const questionsRoute = new Elysia({
  // กำหนด prefix ให้ทุก route ในนี่ขึ้นต้นด้วย /api/questions
  prefix: "/api/questions",
})

  /**
   * =====================================================
   * GET /api/questions/:departmentId
   * =====================================================
   * หน้าที่:
   * - ดึงคำถามทั้งหมดที่ใช้แสดงในหน้าแบบประเมิน
   * - รวมทั้ง "คำถามกลาง" + "คำถามเฉพาะหน่วยงาน"
   *
   * Flow การทำงาน:
   * 1) ตรวจสอบ departmentId จาก URL
   * 2) หา survey ที่กำลังใช้งาน (is_active = true)
   * 3) ดึงคำถามตาม survey + department
   * 4) ส่งข้อมูลกลับให้ frontend
   */
  .get("/:departmentId", async ({ params, set }) => {
    /**
     * Step 1: แปลง departmentId
     * params.departmentId จะเป็น string เสมอ
     * ต้องแปลงเป็น number ก่อนนำไปใช้กับ DB
     */
    const departmentId = Number(params.departmentId);

    /**
     * ถ้าแปลงแล้วไม่ใช่ตัวเลข
     * เช่น /api/questions/abc
     * ให้ตอบกลับด้วย status 400 (Bad Request)
     */
    if (Number.isNaN(departmentId)) {
      set.status = 400;
      return { message: "Invalid department id" };
    }

    /**
     * Step 2: หา survey ที่กำลังใช้งานอยู่
     * หลักการ:
     * - ระบบจะมีแบบประเมินหลายชุดได้
     * - แต่จะมีแค่ 1 ชุดที่เปิดใช้งาน (is_active = true)
     */
    const survey = await getActiveSurvey();

    /**
     * ถ้าไม่เจอ survey ที่ active
     * แปลว่า admin ยังไม่เปิดแบบประเมิน
     */
    if (!survey) {
      set.status = 404;
      return { message: "Active survey not found" };
    }

    /**
     * ดึง survey_id ที่ได้มา
     * ใช้เป็นเงื่อนไขหลักในการดึงคำถาม
     */
    const surveyId = survey.id;

    /**
     * Step 3: ดึงคำถามจากตาราง questions
     * เงื่อนไขในการดึง:
     *
     * SELECT:
     * - เลือกเฉพาะข้อมูลที่หน้าเว็บต้องใช้
     *
     * WHERE:
     * - q.survey_id = $1
     *   → เอาเฉพาะคำถามของแบบประเมินที่กำลังใช้งาน
     *
     * - q.status = 'active'
     *   → ไม่เอาคำถามที่ถูกปิดใช้งาน
     *
     * - เงื่อนไข scope:
     *   → เอาคำถามกลาง (central) ทุกข้อ
     *   → + คำถามเฉพาะหน่วยงานนี้ (department_id)
     *
     * ORDER BY:
     * - display_order
     *   → จัดลำดับคำถามให้แสดงถูกต้องบนหน้าเว็บ
     */
    const sql = `
  SELECT 
    q.id,
    q.text,
    q.type,
    q.scope
  FROM questions q
  WHERE q.survey_id = $1
    AND q.status = 'active'
    AND (
      q.scope = 'central'
      OR (q.scope = 'department' AND q.department_id = $2)
    )
  ORDER BY
  CASE
    WHEN q.scope = 'central' THEN 0
    WHEN q.scope = 'department' THEN 1
    ELSE 2
  END,
  q.display_order ASC,
  q.id ASC

`;

    /**
     * ส่ง query ไปที่ PostgreSQL
     * - $1 = surveyId
     * - $2 = departmentId
     */
    const result = await db.query(sql, [surveyId, departmentId]);

    /**
     * ----------------------------------------
     * Step 4: ส่งข้อมูลกลับให้ Frontend
     * ----------------------------------------
     * total: จำนวนคำถามทั้งหมด
     * items: รายการคำถาม
     */
    return {
      total: result.rowCount,
      items: result.rows,
      survey: {
        id: survey.id,
        year_be: survey.year_be,
        title: survey.title,
      },
    };
  });
