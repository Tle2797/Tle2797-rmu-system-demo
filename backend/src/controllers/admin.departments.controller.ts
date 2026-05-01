import { db } from "../config/db";
import {
  generateDepartmentQRCodeAsset,
  removePublicAsset,
} from "../services/qrcode";

function parseForce(value: unknown) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

async function getDepartmentDependencies(
  client: Pick<typeof db, "query">,
  departmentId: number,
) {
  const res = await client.query(
    `
    SELECT
      (SELECT COUNT(*)::int FROM users WHERE department_id = $1) AS user_count,
      (
        SELECT COUNT(*)::int
        FROM users
        WHERE department_id = $1
          AND role IN ('dept_head', 'staff')
          AND is_active = true
      ) AS active_department_user_count,
      (SELECT COUNT(*)::int FROM responses WHERE department_id = $1) AS response_count,
      (
        SELECT COUNT(*)::int
        FROM answers a
        JOIN responses r ON r.id = a.response_id
        WHERE r.department_id = $1
      ) AS answer_count,
      (
        SELECT COUNT(*)::int
        FROM questions
        WHERE scope = 'department' AND department_id = $1
      ) AS question_count,
      (
        SELECT COUNT(*)::int
        FROM qrcodes
        WHERE type = 'department' AND department_id = $1
      ) AS qrcode_count
    `,
    [departmentId],
  );

  return res.rows[0] ?? null;
}

export async function listAdminDepartments({ query }: any) {
  const includeQr = query.include_qr === "1";

  if (!includeQr) {
    const res = await db.query(
      `
      SELECT id, name, is_active, created_at, updated_at
      FROM departments
      ORDER BY created_at DESC, id DESC
      `,
    );
    return { total: res.rowCount ?? 0, items: res.rows };
  }

  const res = await db.query(
    `
    SELECT
      d.id,
      d.name,
      d.is_active,
      d.created_at,
      d.updated_at,
      q.id AS qrcode_id,
      q.image_path AS qr_image_path,
      q.link_target AS qr_link_target,
      q.created_at AS qr_created_at
    FROM departments d
    LEFT JOIN qrcodes q
      ON q.department_id = d.id
     AND q.type = 'department'
    ORDER BY d.created_at DESC, d.id DESC
    `,
  );

  return { total: res.rowCount ?? 0, items: res.rows };
}

export async function createAdminDepartment({ body, set }: any) {
  const name = (body.name ?? "").trim();
  if (!name) {
    set.status = 400;
    return { message: "Name is required" };
  }

  const client = await db.connect();
  let qrImagePath: string | null = null;

  try {
    await client.query("BEGIN");

    const ins = await client.query(
      `
      INSERT INTO departments(name, is_active)
      VALUES ($1, true)
      RETURNING id, name, is_active, created_at, updated_at
      `,
      [name],
    );

    const department = ins.rows[0];
    const deptId = Number(department.id);
    const qrAsset = await generateDepartmentQRCodeAsset(deptId);
    qrImagePath = qrAsset.imagePath;

    await client.query(
      `DELETE FROM qrcodes WHERE type = 'department' AND department_id = $1`,
      [deptId],
    );

    await client.query(
      `
      INSERT INTO qrcodes (type, department_id, image_path, link_target, is_active)
      VALUES ('department', $1, $2, $3, true)
      `,
      [deptId, qrImagePath, qrAsset.link],
    );

    await client.query("COMMIT");
    set.status = 201;
    return department;
  } catch (err) {
    await client.query("ROLLBACK");

    if (qrImagePath) {
      try {
        removePublicAsset(qrImagePath);
      } catch {
        // ignore filesystem cleanup errors
      }
    }

    throw err;
  } finally {
    client.release();
  }
}

export async function updateAdminDepartment({ params, body, set }: any) {
  const id = Number(params.id);
  if (!Number.isFinite(id) || id <= 0) {
    set.status = 400;
    return { message: "Invalid id" };
  }

  const name = (body.name ?? "").trim();
  if (!name) {
    set.status = 400;
    return { message: "Name is required" };
  }

  const upd = await db.query(
    `
    UPDATE departments
    SET name = $2, updated_at = NOW()
    WHERE id = $1
    RETURNING id, name, is_active, created_at, updated_at
    `,
    [id, name],
  );

  if ((upd.rowCount ?? 0) === 0) {
    set.status = 404;
    return { message: "Department not found" };
  }

  return upd.rows[0];
}

export async function toggleAdminDepartmentActive({ params, set }: any) {
  const id = Number(params.id);
  if (!Number.isFinite(id) || id <= 0) {
    set.status = 400;
    return { message: "Invalid id" };
  }

  const cur = await db.query(
    `SELECT is_active FROM departments WHERE id = $1`,
    [id],
  );

  if (!cur.rowCount || cur.rowCount === 0) {
    set.status = 404;
    return { message: "Department not found" };
  }

  const next = !Boolean(cur.rows[0].is_active);

  const upd = await db.query(
    `
    UPDATE departments
    SET is_active = $2, updated_at = NOW()
    WHERE id = $1
    RETURNING id, name, is_active, created_at, updated_at
    `,
    [id, next],
  );

  return upd.rows[0];
}

export async function patchAdminDepartmentActive({ params, body, set }: any) {
  const id = Number(params.id);
  if (!Number.isFinite(id) || id <= 0) {
    set.status = 400;
    return { message: "Invalid id" };
  }

  const nextActive = Boolean(body.is_active);

  const upd = await db.query(
    `
    UPDATE departments
    SET is_active = $2, updated_at = NOW()
    WHERE id = $1
    RETURNING id, name, is_active, created_at, updated_at
    `,
    [id, nextActive],
  );

  if ((upd.rowCount ?? 0) === 0) {
    set.status = 404;
    return { message: "Department not found" };
  }

  return upd.rows[0];
}

export async function deleteAdminDepartment({ params, query, set }: any) {
  const id = Number(params.id);
  if (!Number.isFinite(id) || id <= 0) {
    set.status = 400;
    return { message: "Invalid id" };
  }

  const forceDelete = parseForce(query.force);
  const client = await db.connect();
  let qrImagePath: string | null = null;
  let result: Record<string, unknown> | null = null;

  try {
    await client.query("BEGIN");

    const deptRes = await client.query(
      `SELECT id, name FROM departments WHERE id = $1 FOR UPDATE`,
      [id],
    );

    if ((deptRes.rowCount ?? 0) === 0) {
      await client.query("ROLLBACK");
      set.status = 404;
      return { message: "Department not found" };
    }

    const dependency = await getDepartmentDependencies(client, id);
    const userCount = Number(dependency?.user_count ?? 0);
    const activeDepartmentUserCount = Number(
      dependency?.active_department_user_count ?? 0,
    );
    const responseCount = Number(dependency?.response_count ?? 0);
    const answerCount = Number(dependency?.answer_count ?? 0);
    const questionCount = Number(dependency?.question_count ?? 0);
    const qrcodeCount = Number(dependency?.qrcode_count ?? 0);

    if (
      (userCount > 0 ||
        responseCount > 0 ||
        answerCount > 0 ||
        questionCount > 0 ||
        qrcodeCount > 0) &&
      !forceDelete
    ) {
      await client.query("ROLLBACK");
      set.status = 409;
      return {
        message: "เธซเธเนเธงเธขเธเธฒเธเธเธตเนเธกเธตเธเนเธญเธกเธนเธฅเธญเนเธฒเธเธญเธดเธเธญเธขเธนเน เธเธฃเธธเธ“เธฒเธขเธทเธเธขเธฑเธเธเนเธญเธเธฅเธ",
        requires_confirmation: true,
        user_count: userCount,
        active_department_user_count: activeDepartmentUserCount,
        response_count: responseCount,
        answer_count: answerCount,
        question_count: questionCount,
        qrcode_count: qrcodeCount,
        affects_evaluation: responseCount > 0 || answerCount > 0,
      };
    }

    const responseIdsRes = await client.query(
      `SELECT id FROM responses WHERE department_id = $1`,
      [id],
    );
    const responseIds = responseIdsRes.rows
      .map((row) => Number(row.id))
      .filter((value) => Number.isFinite(value) && value > 0);

    const questionIdsRes = await client.query(
      `SELECT id FROM questions WHERE scope = 'department' AND department_id = $1`,
      [id],
    );
    const questionIds = questionIdsRes.rows
      .map((row) => Number(row.id))
      .filter((value) => Number.isFinite(value) && value > 0);

    const userUpdateRes = await client.query(
      `
      UPDATE users
      SET
        department_id = NULL,
        is_active = CASE
          WHEN role IN ('dept_head', 'staff') THEN false
          ELSE is_active
        END,
        updated_at = NOW()
      WHERE department_id = $1
      RETURNING id, role, is_active
      `,
      [id],
    );

    let deletedAnswersCount = 0;
    if (responseIds.length > 0) {
      const deletedAnswersByResponseRes = await client.query(
        `DELETE FROM answers WHERE response_id = ANY($1::bigint[])`,
        [responseIds],
      );
      deletedAnswersCount += deletedAnswersByResponseRes.rowCount ?? 0;
    }

    if (questionIds.length > 0) {
      const deletedAnswersByQuestionRes = await client.query(
        `DELETE FROM answers WHERE question_id = ANY($1::bigint[])`,
        [questionIds],
      );
      deletedAnswersCount += deletedAnswersByQuestionRes.rowCount ?? 0;
    }

    let deletedResponsesCount = 0;
    if (responseIds.length > 0) {
      const deletedResponsesRes = await client.query(
        `DELETE FROM responses WHERE id = ANY($1::bigint[]) RETURNING id`,
        [responseIds],
      );
      deletedResponsesCount = deletedResponsesRes.rowCount ?? 0;
    }

    let deletedQuestionsCount = 0;
    if (questionIds.length > 0) {
      const deletedQuestionsRes = await client.query(
        `
        DELETE FROM questions
        WHERE id = ANY($1::bigint[])
        RETURNING id
        `,
        [questionIds],
      );
      deletedQuestionsCount = deletedQuestionsRes.rowCount ?? 0;
    }

    const qrRes = await client.query(
      `
      SELECT image_path
      FROM qrcodes
      WHERE type = 'department' AND department_id = $1
      LIMIT 1
      `,
      [id],
    );

    qrImagePath = qrRes.rows[0]?.image_path ?? null;

    const deletedQrcodeRes = await client.query(
      `DELETE FROM qrcodes WHERE type = 'department' AND department_id = $1`,
      [id],
    );

    const del = await client.query(
      `DELETE FROM departments WHERE id = $1 RETURNING id`,
      [id],
    );

    if ((del.rowCount ?? 0) === 0) {
      await client.query("ROLLBACK");
      set.status = 404;
      return { message: "Department not found" };
    }

    await client.query("COMMIT");
    result = {
      message: "Deleted successfully",
      detached_users: userUpdateRes.rowCount ?? 0,
      deactivated_users: activeDepartmentUserCount,
      deleted_answers: deletedAnswersCount,
      deleted_responses: deletedResponsesCount,
      deleted_questions: deletedQuestionsCount,
      deleted_qrcodes: deletedQrcodeRes.rowCount ?? 0,
      recalculated: deletedAnswersCount > 0 || deletedResponsesCount > 0,
    };
  } catch (err: any) {
    await client.query("ROLLBACK");

    if (err?.code === "23503") {
      set.status = 409;
      return {
        message: "เธซเธเนเธงเธขเธเธฒเธเธเธตเนเธกเธตเธเนเธญเธกเธนเธฅเธญเนเธฒเธเธญเธดเธเธญเธขเธนเน เธเธฃเธธเธ“เธฒเธขเธทเธเธขเธฑเธเธเนเธญเธเธฅเธ",
        requires_confirmation: true,
      };
    }

    throw err;
  } finally {
    client.release();
  }

  if (qrImagePath) {
    try {
      removePublicAsset(qrImagePath);
    } catch {
      // ignore filesystem cleanup errors
    }
  }

  return result ?? { message: "Deleted successfully" };
}
