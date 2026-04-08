import { Elysia, t } from "elysia";
import { db } from "../config/db";

function parseForce(value: unknown) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

async function getTimeSlotDependencies(
  client: Pick<typeof db, "query">,
  timeSlotId: number,
) {
  const res = await client.query(
    `
    SELECT
      (SELECT COUNT(*)::int FROM responses WHERE slot_id = $1) AS response_count,
      (
        SELECT COUNT(*)::int
        FROM answers a
        JOIN responses r ON r.id = a.response_id
        WHERE r.slot_id = $1
      ) AS answer_count,
      (
        SELECT COUNT(*)::int
        FROM survey_time_slots
        WHERE slot_id = $1
      ) AS survey_time_slot_count
    `,
    [timeSlotId],
  );

  return res.rows[0] ?? null;
}

/**
 * Admin Time Slots Route
 * prefix: /api/admin/time_slots
 */
export const adminTimeSlotsRoute = new Elysia({
  prefix: "/api/admin/time_slots",
})

  /**
   * GET /api/admin/time_slots
   * ดึงข้อมูลช่วงเวลาทั้งหมด
   */
  .get(
    "/",
    async ({ set }) => {
      const res = await db.query(
        `
        SELECT id, name, start_time, end_time, max_attempts, is_active, created_at, updated_at
        FROM time_slots
        ORDER BY start_time ASC
        `
      );
      return { total: res.rowCount ?? 0, items: res.rows };
    }
  )

  /**
   * POST /api/admin/time_slots
   * สร้างช่วงเวลาใหม่
   */
  .post(
    "/",
    async ({ body, set }) => {
      const { name, start_time, end_time, max_attempts } = body;

      const trimmedName = (name ?? "").trim();
      if (!trimmedName) {
        set.status = 400;
        return { message: "Name is required" };
      }
      
      if (start_time >= end_time) {
        set.status = 400;
        return { message: "start_time must be before end_time" };
      }

      const ins = await db.query(
        `
        INSERT INTO time_slots (name, start_time, end_time, max_attempts, is_active)
        VALUES ($1, $2, $3, $4, true)
        RETURNING id, name, start_time, end_time, max_attempts, is_active, created_at, updated_at
        `,
        [trimmedName, start_time, end_time, max_attempts || 1],
      );

      set.status = 201;
      return ins.rows[0];
    },
    {
      body: t.Object({
        name: t.String(),
        start_time: t.String(), // e.g. "08:00:00"
        end_time: t.String(),   // e.g. "12:00:00"
        max_attempts: t.Optional(t.Numeric()),
      }),
    },
  )

  /**
   * PUT /api/admin/time_slots/:id
   * แก้ไขช่วงเวลา
   */
  .put(
    "/:id",
    async ({ params, body, set }) => {
      const id = Number(params.id);
      if (!Number.isFinite(id) || id <= 0) {
        set.status = 400;
        return { message: "Invalid id" };
      }

      const { name, start_time, end_time, max_attempts } = body;
      const trimmedName = (name ?? "").trim();
      
      if (!trimmedName) {
        set.status = 400;
        return { message: "Name is required" };
      }

      if (start_time >= end_time) {
        set.status = 400;
        return { message: "start_time must be before end_time" };
      }

      const upd = await db.query(
        `
        UPDATE time_slots
        SET name = $2, start_time = $3, end_time = $4, max_attempts = $5, updated_at = NOW()
        WHERE id = $1
        RETURNING id, name, start_time, end_time, max_attempts, is_active, created_at, updated_at
        `,
        [id, trimmedName, start_time, end_time, max_attempts || 1],
      );

      if ((upd.rowCount ?? 0) === 0) {
        set.status = 404;
        return { message: "Time slot not found" };
      }

      return upd.rows[0];
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({ 
        name: t.String(),
        start_time: t.String(),
        end_time: t.String(),
        max_attempts: t.Optional(t.Numeric()),
      }),
    },
  )

  /**
   * PUT /api/admin/time_slots/:id/toggle-active
   * เปิด-ปิดการใช้งาน
   */
  .put(
    "/:id/toggle-active",
    async ({ params, set }) => {
      const id = Number(params.id);
      if (!Number.isFinite(id) || id <= 0) {
        set.status = 400;
        return { message: "Invalid id" };
      }

      const cur = await db.query(
        `SELECT is_active FROM time_slots WHERE id = $1`,
        [id],
      );

      if (!cur.rowCount || cur.rowCount === 0) {
        set.status = 404;
        return { message: "Time slot not found" };
      }

      const next = !Boolean(cur.rows[0].is_active);

      const upd = await db.query(
        `
        UPDATE time_slots
        SET is_active = $2, updated_at = NOW()
        WHERE id = $1
        RETURNING id, name, start_time, end_time, max_attempts, is_active, created_at, updated_at
        `,
        [id, next],
      );

      return upd.rows[0];
    },
    { params: t.Object({ id: t.String() }) },
  )

  /**
   * DELETE /api/admin/time_slots/:id
   * ลบช่วงเวลา (ถ้ามีข้อมูลอ้างอิง จะตอบกลับรายละเอียดให้ยืนยันก่อนลบ)
   */
  .delete(
    "/:id",
    async ({ params, query, set }) => {
      const id = Number(params.id);
      if (!Number.isFinite(id) || id <= 0) {
        set.status = 400;
        return { message: "Invalid id" };
      }

      const forceDelete = parseForce(query.force);
      const client = await db.connect();
      let result: Record<string, unknown> | null = null;

      try {
        await client.query("BEGIN");

        const current = await client.query(
          `SELECT id FROM time_slots WHERE id = $1 FOR UPDATE`,
          [id],
        );

        if ((current.rowCount ?? 0) === 0) {
          await client.query("ROLLBACK");
          set.status = 404;
          return { message: "Time slot not found" };
        }

        const dependency = await getTimeSlotDependencies(client, id);
        const responseCount = Number(dependency?.response_count ?? 0);
        const answerCount = Number(dependency?.answer_count ?? 0);
        const surveyTimeSlotCount = Number(dependency?.survey_time_slot_count ?? 0);

        if (
          (responseCount > 0 || answerCount > 0 || surveyTimeSlotCount > 0) &&
          !forceDelete
        ) {
          await client.query("ROLLBACK");
          set.status = 409;
          return {
            message: "ช่วงเวลานี้มีข้อมูลอ้างอิงอยู่ กรุณายืนยันก่อนลบ",
            requires_confirmation: true,
            response_count: responseCount,
            answer_count: answerCount,
            survey_time_slot_count: surveyTimeSlotCount,
            affects_evaluation: responseCount > 0 || answerCount > 0,
          };
        }

        const responseIdsRes = await client.query(
          `SELECT id FROM responses WHERE slot_id = $1`,
          [id],
        );
        const responseIds = responseIdsRes.rows
          .map((row) => Number(row.id))
          .filter((value) => Number.isFinite(value) && value > 0);

        let deletedAnswersCount = 0;
        if (responseIds.length > 0) {
          const deletedAnswersRes = await client.query(
            `DELETE FROM answers WHERE response_id = ANY($1::bigint[])`,
            [responseIds],
          );
          deletedAnswersCount = deletedAnswersRes.rowCount ?? 0;
        }

        let deletedResponsesCount = 0;
        if (responseIds.length > 0) {
          const deletedResponsesRes = await client.query(
            `DELETE FROM responses WHERE id = ANY($1::bigint[]) RETURNING id`,
            [responseIds],
          );
          deletedResponsesCount = deletedResponsesRes.rowCount ?? 0;
        }

        const deletedSurveyTimeSlotsRes = await client.query(
          `DELETE FROM survey_time_slots WHERE slot_id = $1`,
          [id],
        );

        const del = await client.query(
          `DELETE FROM time_slots WHERE id = $1 RETURNING id`,
          [id],
        );

        if ((del.rowCount ?? 0) === 0) {
          await client.query("ROLLBACK");
          set.status = 404;
          return { message: "Time slot not found" };
        }

        await client.query("COMMIT");
        result = {
          message: "Deleted successfully",
          deleted_answers: deletedAnswersCount,
          deleted_responses: deletedResponsesCount,
          deleted_survey_time_slots: deletedSurveyTimeSlotsRes.rowCount ?? 0,
          recalculated: deletedAnswersCount > 0 || deletedResponsesCount > 0,
        };
      } catch (err: any) {
        await client.query("ROLLBACK");
        if (err.code === "23503") {
          set.status = 409;
          return {
            message: "ช่วงเวลานี้มีข้อมูลอ้างอิงอยู่ กรุณายืนยันก่อนลบ",
            requires_confirmation: true,
          };
        }
        throw err;
      } finally {
        client.release();
      }

      return result ?? { message: "Deleted successfully" };
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({
        force: t.Optional(t.String()),
      }),
    }
  );
