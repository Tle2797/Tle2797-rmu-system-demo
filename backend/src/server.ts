// backend/src/server.ts
import { app } from "./app";

const port = Number(process.env.PORT) || 3080;

app.listen(port);

console.log(`🚀 Backend running at http://localhost:${port}`);