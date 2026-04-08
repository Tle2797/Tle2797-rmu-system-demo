import fs from "fs";
import path from "path";
import QRCode from "qrcode";
import { db } from "../src/config/db";

type DepartmentQrRow = {
  qrcode_id: number;
  department_id: number;
  department_name: string;
  link_target: string;
  image_path: string;
};

const SURVEY_BASE_URL =
  process.env.SURVEY_BASE_URL || "http://localhost:3000";
const QR_DIR = path.resolve(process.cwd(), "public", "qrcodes");
const DRY_RUN = process.argv.includes("--dry-run");

if (!fs.existsSync(QR_DIR)) {
  fs.mkdirSync(QR_DIR, { recursive: true });
}

async function generateQRFile(filename: string, url: string): Promise<void> {
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
}

async function main() {
  const client = await db.connect();

  try {
    const res = await client.query<DepartmentQrRow>(`
      SELECT
        q.id AS qrcode_id,
        q.department_id,
        d.name AS department_name,
        q.link_target,
        q.image_path
      FROM qrcodes q
      INNER JOIN departments d
        ON d.id = q.department_id
      WHERE q.type = 'department'
      ORDER BY q.department_id ASC, q.id ASC
    `);

    if ((res.rowCount ?? 0) === 0) {
      console.log("No department QR codes found. Nothing to migrate.");
      return;
    }

    const rows = res.rows;
    console.log(
      `${DRY_RUN ? "[dry-run] " : ""}Found ${rows.length} department QR code(s) to migrate.`
    );

    for (const row of rows) {
      const deptId = Number(row.department_id);
      const newLink = `${SURVEY_BASE_URL}/survey/${deptId}`;
      const filename = `dept_${deptId}.png`;
      const newImagePath = `/qrcodes/${filename}`;

      if (DRY_RUN) {
        console.log(
          `[dry-run] dept ${deptId} (${row.department_name}): ${row.link_target} -> ${newLink}`
        );
        continue;
      }

      await generateQRFile(filename, newLink);
      await client.query(
        `
        UPDATE qrcodes
        SET link_target = $1,
            image_path = $2
        WHERE id = $3
        `,
        [newLink, newImagePath, row.qrcode_id]
      );

      console.log(
        `Updated dept ${deptId} (${row.department_name}) -> ${newLink}`
      );
    }

    if (!DRY_RUN) {
      console.log(`Done. Migrated ${rows.length} QR code(s).`);
    }
  } catch (error) {
    console.error("QR migration failed:", error);
    process.exitCode = 1;
  } finally {
    client.release();
    await db.end();
  }
}

void main();
