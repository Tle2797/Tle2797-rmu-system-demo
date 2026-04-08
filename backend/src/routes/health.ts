import { Elysia, status } from "elysia";
import { db } from "../config/db";

export const healthRoute = new Elysia({ prefix: "/health" })
    .get("/", async () => {
        // query ทดสอบ DB 
        const result = await db.query("SELECT NOW()");
        return {
            status: "ok",
            db_time: result.rows[0].now,
        };
    });