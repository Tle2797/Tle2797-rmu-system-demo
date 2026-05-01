import { db } from "../config/db";
import { getActiveSurvey } from "../utils/surveys";

function parseForce(value: unknown) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

async function getCentralQuestionUsage(questionId: number) {
  const res = await db.query(
    `
    SELECT
      q.id,
      q.text,
      COUNT(a.id)::int AS answer_count,
      COUNT(DISTINCT a.response_id)::int AS response_count
    FROM questions q
    LEFT JOIN answers a ON a.question_id = q.id
    WHERE q.id = $1
      AND q.scope = 'central'
    GROUP BY q.id, q.text
    `,
    [questionId],
  );

  return res.rows[0] ?? null;
}

export async function listCentralQuestions({ query }: any) {
  let surveyId: number | null = null;

  if (query.survey_id) {
    surveyId = Number(query.survey_id);
  } else {
    const activeSurvey = await getActiveSurvey();
    if (activeSurvey) {
      surveyId = activeSurvey.id;
    }
  }

  if (!surveyId) {
    return { total: 0, items: [], message: "No active survey found" };
  }

  const res = await db.query(
    `
    SELECT
      q.id,
      q.survey_id,
      q.scope,
      q.type,
      q.text,
      q.display_order,
      q.status,
      q.created_at,
      q.updated_at,
      COUNT(a.id)::int AS answer_count,
      COUNT(DISTINCT a.response_id)::int AS response_count,
      (COUNT(a.id) > 0) AS has_answers
    FROM questions q
    LEFT JOIN answers a ON a.question_id = q.id
    WHERE q.scope = 'central'
      AND q.survey_id = $1
      AND q.department_id IS NULL
    GROUP BY
      q.id,
      q.survey_id,
      q.scope,
      q.type,
      q.text,
      q.display_order,
      q.status,
      q.created_at,
      q.updated_at
    ORDER BY q.display_order ASC, q.id ASC
    `,
    [surveyId],
  );

  return { total: res.rowCount ?? 0, items: res.rows, survey_id: surveyId };
}

export async function createCentralQuestion({ body, set }: any) {
  const { survey_id, text, type, display_order } = body;

  const trimmedText = (text ?? "").trim();
  if (!trimmedText) {
    set.status = 400;
    return { message: "Question text is required" };
  }
  if (!survey_id) {
    set.status = 400;
    return { message: "survey_id is required" };
  }

  const ins = await db.query(
    `
    INSERT INTO questions (survey_id, scope, department_id, type, text, display_order, status)
    VALUES ($1, 'central', NULL, $2, $3, $4, 'active')
    RETURNING id, survey_id, scope, type, text, display_order, status, created_at, updated_at
    `,
    [survey_id, type, trimmedText, display_order || 0],
  );

  set.status = 201;
  return ins.rows[0];
}

export async function updateCentralQuestion({ params, body, set }: any) {
  const id = Number(params.id);
  if (!Number.isFinite(id) || id <= 0) {
    set.status = 400;
    return { message: "Invalid id" };
  }

  const { text, type, display_order } = body;
  const trimmedText = (text ?? "").trim();

  if (!trimmedText) {
    set.status = 400;
    return { message: "Question text is required" };
  }

  const upd = await db.query(
    `
    UPDATE questions
    SET text = $2, type = $3, display_order = $4, updated_at = NOW()
    WHERE id = $1 AND scope = 'central'
    RETURNING id, survey_id, scope, type, text, display_order, status, created_at, updated_at
    `,
    [id, trimmedText, type, display_order || 0],
  );

  if ((upd.rowCount ?? 0) === 0) {
    set.status = 404;
    return { message: "Central question not found" };
  }

  return upd.rows[0];
}

export async function toggleCentralQuestionActive({ params, set }: any) {
  const id = Number(params.id);
  if (!Number.isFinite(id) || id <= 0) {
    set.status = 400;
    return { message: "Invalid id" };
  }

  const cur = await db.query(
    `SELECT status FROM questions WHERE id = $1 AND scope = 'central'`,
    [id],
  );

  if (!cur.rowCount || cur.rowCount === 0) {
    set.status = 404;
    return { message: "Central question not found" };
  }

  const currentStatus = cur.rows[0].status;
  const nextStatus = currentStatus === "active" ? "inactive" : "active";

  const upd = await db.query(
    `
    UPDATE questions
    SET status = $2, updated_at = NOW()
    WHERE id = $1 AND scope = 'central'
    RETURNING id, survey_id, scope, type, text, display_order, status, created_at, updated_at
    `,
    [id, nextStatus],
  );

  return upd.rows[0];
}

export async function deleteCentralQuestion({ params, query, set }: any) {
  const id = Number(params.id);
  if (!Number.isFinite(id) || id <= 0) {
    set.status = 400;
    return { message: "Invalid id" };
  }

  const usage = await getCentralQuestionUsage(id);
  if (!usage) {
    set.status = 404;
    return { message: "Central question not found" };
  }

  const forceDelete = parseForce(query.force);
  if (usage.answer_count > 0 && !forceDelete) {
    set.status = 409;
    return {
      message:
        "Question already has submitted answers. Confirm deletion before removing it.",
      answer_count: usage.answer_count,
      response_count: usage.response_count,
      has_answers: true,
      requires_confirmation: true,
    };
  }

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const affectedResponsesRes = await client.query(
      `SELECT DISTINCT response_id FROM answers WHERE question_id = $1`,
      [id],
    );
    const affectedResponseIds = affectedResponsesRes.rows
      .map((row) => Number(row.response_id))
      .filter((value) => Number.isFinite(value) && value > 0);

    const deletedAnswers = await client.query(
      `DELETE FROM answers WHERE question_id = $1`,
      [id],
    );

    let deletedResponsesCount = 0;
    if (affectedResponseIds.length > 0) {
      const deletedResponses = await client.query(
        `
        DELETE FROM responses r
        WHERE r.id = ANY($1::bigint[])
          AND NOT EXISTS (
            SELECT 1
            FROM answers a
            WHERE a.response_id = r.id
          )
        RETURNING id
        `,
        [affectedResponseIds],
      );
      deletedResponsesCount = deletedResponses.rowCount ?? 0;
    }

    const del = await client.query(
      `DELETE FROM questions WHERE id = $1 AND scope = 'central' RETURNING id`,
      [id],
    );

    if ((del.rowCount ?? 0) === 0) {
      await client.query("ROLLBACK");
      set.status = 404;
      return { message: "Central question not found" };
    }

    await client.query("COMMIT");
    return {
      message: "Deleted successfully",
      deleted_answers: deletedAnswers.rowCount ?? 0,
      affected_responses: affectedResponseIds.length,
      deleted_responses: deletedResponsesCount,
      recalculated: true,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
