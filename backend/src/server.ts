// backend/src/server.ts
import { app } from "./app";
import { ensureUserApprovalColumns } from "./config/db";

const port = Number(process.env.PORT) || 3080;

await ensureUserApprovalColumns();

app.listen(port);

console.log(`🚀 Backend running at http://localhost:${port}`);
