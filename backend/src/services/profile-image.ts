import fs from "fs";
import path from "path";

export class ProfileImageUploadError extends Error {
  status: number;
  body: Record<string, unknown>;

  constructor(status: number, body: Record<string, unknown>) {
    super(String(body.message ?? "Profile image upload failed"));
    this.status = status;
    this.body = body;
  }
}

type UploadableFile = {
  arrayBuffer: () => Promise<ArrayBuffer>;
  name?: string;
  type?: string;
  size?: number;
};

function normalizeUploadFile(fileValue: unknown) {
  if (
    !fileValue ||
    typeof fileValue !== "object" ||
    !("arrayBuffer" in fileValue)
  ) {
    throw new ProfileImageUploadError(400, {
      message: "image file is required",
    });
  }

  return fileValue as UploadableFile;
}

function getImageExtension(file: UploadableFile) {
  const mime = String(file.type || "").toLowerCase();
  const fileName = String(file.name || "");
  const extFromName = path.extname(fileName).replace(/^\./, "").toLowerCase();

  const ext =
    mime === "image/jpeg" || mime === "image/jpg"
      ? "jpg"
      : mime === "image/png"
        ? "png"
        : mime === "image/webp"
          ? "webp"
          : mime === "image/gif"
            ? "gif"
            : extFromName === "jpeg"
              ? "jpg"
              : extFromName;

  if (!["jpg", "png", "webp", "gif"].includes(ext)) {
    throw new ProfileImageUploadError(400, {
      message: "Unsupported image type",
    });
  }

  return ext;
}

export async function saveProfileImage(
  userId: number,
  fileValue: unknown,
) {
  const file = normalizeUploadFile(fileValue);
  const fileSize = Number(file.size || 0);

  if (fileSize > 5 * 1024 * 1024) {
    throw new ProfileImageUploadError(400, {
      message: "image file must be smaller than 5MB",
    });
  }

  const ext = getImageExtension(file);
  const uploadDir = path.resolve(process.cwd(), "public", "uploads", "profiles");
  fs.mkdirSync(uploadDir, { recursive: true });

  const filename = `profile-${userId}.${ext}`;
  const targetPath = path.join(uploadDir, filename);
  const buffer = new Uint8Array(await file.arrayBuffer());

  fs.writeFileSync(targetPath, buffer);

  for (const entry of fs.readdirSync(uploadDir)) {
    if (entry.startsWith(`profile-${userId}.`) && entry !== filename) {
      try {
        fs.unlinkSync(path.join(uploadDir, entry));
      } catch {
        // Ignore unlink errors for stale files.
      }
    }
  }

  return {
    profile_image_url: `/uploads/profiles/${filename}`,
  };
}
