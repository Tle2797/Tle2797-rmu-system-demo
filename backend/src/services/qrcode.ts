import fs from "fs";
import path from "path";
import QRCode from "qrcode";

const SURVEY_BASE_URL =
  process.env.SURVEY_BASE_URL || "http://localhost:3000";
const QR_DIR = path.resolve(process.cwd(), "public", "qrcodes");

function ensureQRDirectory() {
  if (!fs.existsSync(QR_DIR)) {
    fs.mkdirSync(QR_DIR, { recursive: true });
  }
}

async function generateQRCodeFile(filename: string, url: string) {
  ensureQRDirectory();

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

export async function generateCentralQRCodeAsset() {
  const link = `${SURVEY_BASE_URL}/survey`;
  const filename = "central.png";

  await generateQRCodeFile(filename, link);

  return {
    filename,
    link,
    imagePath: `/qrcodes/${filename}`,
  };
}

export async function generateDepartmentQRCodeAsset(departmentId: number) {
  const link = `${SURVEY_BASE_URL}/survey/${departmentId}`;
  const filename = `dept_${departmentId}.png`;

  await generateQRCodeFile(filename, link);

  return {
    filename,
    link,
    imagePath: `/qrcodes/${filename}`,
  };
}

export function resolvePublicAssetPath(assetPath: string) {
  return path.resolve(
    process.cwd(),
    "public",
    assetPath.replace(/^\//, ""),
  );
}

export function readPublicAssetBase64(assetPath: string) {
  const filePath = resolvePublicAssetPath(assetPath);
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return fs.readFileSync(filePath).toString("base64");
}

export function removePublicAsset(assetPath: string) {
  const filePath = resolvePublicAssetPath(assetPath);
  if (!fs.existsSync(filePath)) {
    return;
  }

  fs.unlinkSync(filePath);
}
