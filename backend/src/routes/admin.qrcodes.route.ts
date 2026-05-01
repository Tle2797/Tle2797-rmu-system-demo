import { Elysia, t } from "elysia";
import {
  downloadQRCode,
  generateQRCode,
  listQRCodes,
} from "../controllers/admin.qrcodes.controller";

export const adminQRCodesRoute = new Elysia({ prefix: "/api/admin/qrcodes" })
  .get("/", listQRCodes)
  .post("/generate", generateQRCode, {
    body: t.Object(
      {
        type: t.String(),
        department_id: t.Optional(t.Union([t.Number(), t.String()])),
      },
      { additionalProperties: true }
    ),
  })
  .get("/download/:id", downloadQRCode);
