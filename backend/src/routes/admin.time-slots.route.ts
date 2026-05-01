import { Elysia, t } from "elysia";
import {
  createTimeSlot,
  deleteTimeSlot,
  listTimeSlots,
  toggleTimeSlotActive,
  updateTimeSlot,
} from "../controllers/admin.time-slots.controller";

export const adminTimeSlotsRoute = new Elysia({
  prefix: "/api/admin/time_slots",
})
  .get("/", listTimeSlots)
  .post("/", createTimeSlot, {
    body: t.Object({
      name: t.String(),
      start_time: t.String(),
      end_time: t.String(),
      max_attempts: t.Optional(t.Numeric()),
    }),
  })
  .put("/:id", updateTimeSlot, {
    params: t.Object({ id: t.String() }),
    body: t.Object({
      name: t.String(),
      start_time: t.String(),
      end_time: t.String(),
      max_attempts: t.Optional(t.Numeric()),
    }),
  })
  .put("/:id/toggle-active", toggleTimeSlotActive, {
    params: t.Object({ id: t.String() }),
  })
  .delete("/:id", deleteTimeSlot, {
    params: t.Object({ id: t.String() }),
    query: t.Object({
      force: t.Optional(t.String()),
    }),
  });
