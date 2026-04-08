import { Elysia } from "elysia";
import { db } from "../config/db";

type AnswerType = "rating" | "text";

function getDateKey(value: unknown) {
  return String(value ?? "").slice(0, 10);
}

export const responsesRoute = new Elysia({ prefix: "/api/responses" }).post(
  "/",
  async ({ body, set }) => {
    const payload = body as Record<string, unknown>;

    const departmentId = Number(payload.department_id);
    const group = payload.respondent_group as "student" | "staff" | "public";
    const token = String(payload.token || "");
    const answers = Array.isArray(payload.answers) ? payload.answers : [];

    if (Number.isNaN(departmentId) || departmentId <= 0) {
      set.status = 400;
      return { message: "Invalid department_id" };
    }

    if (!["student", "staff", "public"].includes(group)) {
      set.status = 400;
      return { message: "Invalid respondent_group" };
    }

    if (!token || token.length < 10) {
      set.status = 400;
      return { message: "Invalid token" };
    }

    if (answers.length === 0) {
      set.status = 400;
      return { message: "answers is required" };
    }

    const activeSurveyRes = await db.query(
      `
      SELECT
        id,
        to_char((timezone('Asia/Bangkok', now()))::date, 'YYYY-MM-DD') AS today_bkk,
        ((timezone('Asia/Bangkok', now()))::date >= COALESCE(starts_at, (timezone('Asia/Bangkok', now()))::date)) AS after_start,
        ((timezone('Asia/Bangkok', now()))::date <= COALESCE(ends_at, (timezone('Asia/Bangkok', now()))::date)) AS before_end
      FROM surveys
      WHERE is_active = true
      ORDER BY updated_at DESC NULLS LAST, year_be DESC, id DESC
      LIMIT 1
      `,
    );

    if (activeSurveyRes.rowCount === 0) {
      set.status = 404;
      return { message: "Active survey not found" };
    }

    const activeSurvey = activeSurveyRes.rows[0];
    const surveyId = Number(activeSurvey.id);
    const todayBkk = getDateKey(activeSurvey.today_bkk);

    if (!activeSurvey.after_start) {
      set.status = 403;
      return { message: "Survey is not open yet" };
    }

    if (!activeSurvey.before_end) {
      set.status = 403;
      return { message: "Survey is closed" };
    }

    const mappedSlotRes = await db.query(
      `
      SELECT
        ts.id,
        COALESCE(ts.max_attempts, 1) AS max_attempts
      FROM survey_time_slots sts
      JOIN time_slots ts ON ts.id = sts.slot_id
      WHERE sts.survey_id = $1
        AND ts.is_active = true
        AND (timezone('Asia/Bangkok', now()))::time >= ts.start_time
        AND (timezone('Asia/Bangkok', now()))::time < ts.end_time
      ORDER BY ts.start_time ASC
      LIMIT 1
      `,
      [surveyId],
    );

    let activeSlot = mappedSlotRes.rows[0] ?? null;

    if (!activeSlot) {
      const surveySlotMappingRes = await db.query(
        `SELECT 1 FROM survey_time_slots WHERE survey_id = $1 LIMIT 1`,
        [surveyId],
      );

      if ((surveySlotMappingRes.rowCount ?? 0) > 0) {
        set.status = 403;
        return {
          message: "Out of allowed time slot",
          hint: "Please try again during configured time slots.",
        };
      }

      const fallbackSlotRes = await db.query(`
        SELECT id, COALESCE(max_attempts, 1) AS max_attempts
        FROM time_slots
        WHERE is_active = true
          AND (timezone('Asia/Bangkok', now()))::time >= start_time
          AND (timezone('Asia/Bangkok', now()))::time < end_time
        ORDER BY start_time ASC
        LIMIT 1
      `);

      if (fallbackSlotRes.rowCount === 0) {
        set.status = 403;
        return {
          message: "Out of allowed time slot",
          hint: "Please try again during configured time slots.",
        };
      }

      activeSlot = fallbackSlotRes.rows[0];
    }

    const slotId = Number(activeSlot.id);
    const slotMaxAttempts = Number(activeSlot.max_attempts || 1);

    const deptRes = await db.query(
      `SELECT id FROM departments WHERE id = $1 AND is_active = true`,
      [departmentId],
    );

    if (deptRes.rowCount === 0) {
      set.status = 404;
      return { message: "Department not found" };
    }

    const allowedQRes = await db.query(
      `
      SELECT q.id, q.type
      FROM questions q
      WHERE q.survey_id = $1
        AND q.status = 'active'
        AND (
          q.scope = 'central'
          OR (q.scope = 'department' AND q.department_id = $2)
        )
      `,
      [surveyId, departmentId],
    );

    if (allowedQRes.rowCount === 0) {
      set.status = 404;
      return { message: "No questions configured for this department" };
    }

    const allowedMap = new Map<number, AnswerType>();
    for (const row of allowedQRes.rows) {
      allowedMap.set(Number(row.id), row.type as AnswerType);
    }

    const seenQuestionIds = new Set<number>();
    for (const item of answers as Array<Record<string, unknown>>) {
      const qid = Number(item.question_id);

      if (!Number.isFinite(qid) || qid <= 0) {
        set.status = 400;
        return { message: "Invalid question_id" };
      }

      if (seenQuestionIds.has(qid)) {
        set.status = 400;
        return { message: `Duplicate question_id: ${qid}` };
      }
      seenQuestionIds.add(qid);

      if (!allowedMap.has(qid)) {
        set.status = 400;
        return { message: `Invalid question_id: ${qid}` };
      }

      const qType = allowedMap.get(qid);

      if (qType === "rating") {
        const rating = Number(item.rating);
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
          set.status = 400;
          return { message: `Invalid rating for question_id ${qid}` };
        }
      }

      if (qType === "text" && item.comment !== undefined && item.comment !== null) {
        if (typeof item.comment !== "string") {
          set.status = 400;
          return { message: `Invalid comment for question_id ${qid}` };
        }
      }
    }

    const client = await db.connect();

    try {
      await client.query("BEGIN");

      const tokenRes = await client.query(
        `
        INSERT INTO respondent_tokens (token, last_seen_at)
        VALUES ($1, now())
        ON CONFLICT (token)
        DO UPDATE SET last_seen_at = now()
        RETURNING id
        `,
        [token],
      );
      const respondentTokenId = Number(tokenRes.rows[0].id);

      await client.query(
        `SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))`,
        [String(surveyId), `${respondentTokenId}:${departmentId}:${slotId}:${todayBkk}`],
      );

      const attemptsRes = await client.query(
        `
        SELECT COUNT(*)::int AS attempt_count
        FROM responses
        WHERE survey_id = $1
          AND respondent_token_id = $2
          AND department_id = $3
          AND slot_id = $4
          AND responded_date = $5::date
        `,
        [surveyId, respondentTokenId, departmentId, slotId, todayBkk],
      );

      if (Number(attemptsRes.rows[0].attempt_count) >= slotMaxAttempts) {
        throw { code: "MAX_ATTEMPTS_REACHED" };
      }

      const respRes = await client.query(
        `
        INSERT INTO responses
          (survey_id, department_id, slot_id, respondent_token_id, respondent_group, responded_date)
        VALUES
          ($1, $2, $3, $4, $5, $6::date)
        RETURNING id
        `,
        [surveyId, departmentId, slotId, respondentTokenId, group, todayBkk],
      );

      const responseId = Number(respRes.rows[0].id);

      for (const item of answers as Array<Record<string, unknown>>) {
        const qid = Number(item.question_id);
        const qType = allowedMap.get(qid);
        const rating = qType === "rating" ? Number(item.rating) : null;
        const comment =
          qType === "text"
            ? item.comment === undefined || item.comment === null
              ? null
              : String(item.comment).trim()
            : null;

        await client.query(
          `
          INSERT INTO answers (response_id, question_id, rating, comment)
          VALUES ($1, $2, $3, $4)
          `,
          [responseId, qid, rating, comment],
        );
      }

      await client.query("COMMIT");

      set.status = 201;
      return {
        message: "Submitted successfully",
        response_id: responseId,
        slot_id: slotId,
        survey_id: surveyId,
      };
    } catch (err: any) {
      await client.query("ROLLBACK");

      if (err?.code === "MAX_ATTEMPTS_REACHED") {
        set.status = 409;
        return {
          message: "Already submitted the maximum number of times in this time slot",
          hint: "You can submit again in the next slot or another day.",
        };
      }

      if (err?.code === "23505") {
        set.status = 409;
        return {
          message: "Already submitted in this time slot",
          hint: "You can submit again in the next slot or another day.",
        };
      }

      console.error("Submit error:", err);
      set.status = 500;
      return { message: "Internal server error" };
    } finally {
      client.release();
    }
  },
);
