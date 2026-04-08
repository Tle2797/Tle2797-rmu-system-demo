"use client";

import React, { useEffect, useMemo, useState, type ComponentType, type SVGProps } from "react";
import { CircleCheck, CircleX, Clock3, X } from "lucide-react";
import Swal from "sweetalert2";
import { apiDeleteWithMeta, apiGet, apiPost, apiPut } from "@/lib/api";

type TimeSlotRow = {
  id: number;
  name: string;
  start_time: string;
  end_time: string;
  max_attempts: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

type TimeSlotListRes = {
  total: number;
  items: TimeSlotRow[];
};

type TimeSlotDeleteResponse = {
  message: string;
  requires_confirmation?: boolean;
  response_count?: number;
  answer_count?: number;
  survey_time_slot_count?: number;
  affects_evaluation?: boolean;
  deleted_answers?: number;
  deleted_responses?: number;
  deleted_survey_time_slots?: number;
  recalculated?: boolean;
};

type ModalMode = "create" | "edit";
type StatusFilter = "all" | "active" | "inactive";
type KpiIcon = ComponentType<SVGProps<SVGSVGElement>>;

const PAGE_SIZE = 10;
const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-800 placeholder:text-slate-400 shadow-sm outline-none transition hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-100 disabled:cursor-not-allowed disabled:bg-slate-50";
const selectClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-800 shadow-sm outline-none transition hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-100 disabled:cursor-not-allowed disabled:bg-slate-50";
const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "ทั้งหมด" },
  { value: "active", label: "เปิดใช้งาน" },
  { value: "inactive", label: "ปิดใช้งาน" },
];
const THEME = {
  total: { cardClass: "border-slate-200/80 bg-white/95 shadow-[0_16px_40px_rgba(37,99,235,0.08)]", iconClass: "from-sky-500 to-cyan-500" },
  active: { cardClass: "border-slate-200/80 bg-white/95 shadow-[0_16px_40px_rgba(37,99,235,0.08)]", iconClass: "from-emerald-500 to-teal-500" },
  inactive: { cardClass: "border-slate-200/80 bg-white/95 shadow-[0_16px_40px_rgba(37,99,235,0.08)]", iconClass: "from-slate-500 to-slate-600" },
} as const;

const formatTimeStr = (t: string) => `${t.slice(0, 5)} น.`;

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message || fallback;
  if (typeof error === "string" && error.trim()) return error;
  return fallback;
}

function isTimeSlotDeleteResponse(value: unknown): value is TimeSlotDeleteResponse {
  return typeof value === "object" && value !== null && "message" in value;
}

function formatCount(value: number | null | undefined) {
  return Number(value ?? 0).toLocaleString("th-TH");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildTimeSlotDependencyHtml(name: string, data: TimeSlotDeleteResponse) {
  const dependencyItems: string[] = [];

  if ((data.survey_time_slot_count ?? 0) > 0) {
    dependencyItems.push(
      `มีแบบสอบถามผูกกับช่วงเวลานี้ ${formatCount(data.survey_time_slot_count)} รายการ`,
    );
  }
  if ((data.response_count ?? 0) > 0) {
    dependencyItems.push(
      `มีแบบประเมินที่ส่งในช่วงเวลานี้ ${formatCount(data.response_count)} รายการ`,
    );
  }
  if ((data.answer_count ?? 0) > 0) {
    dependencyItems.push(
      `มีคำตอบและความคิดเห็นที่เกี่ยวข้อง ${formatCount(data.answer_count)} รายการ`,
    );
  }

  const effectItems: string[] = [];
  if ((data.survey_time_slot_count ?? 0) > 0) {
    effectItems.push("การผูกช่วงเวลากับแบบสอบถามจะถูกลบออก");
  }
  if (data.affects_evaluation) {
    effectItems.push(
      "ผลการประเมิน ความคิดเห็น และคะแนนจากช่วงเวลานี้จะถูกลบออก แล้วระบบจะคำนวณใหม่จากข้อมูลที่เหลือ",
    );
  }

  const dependencyList = dependencyItems
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");
  const effectList = effectItems
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");

  return `
    <div class="space-y-3 text-left">
      <p>ช่วงเวลา <strong>${escapeHtml(name)}</strong> ยังมีข้อมูลอ้างอิงดังนี้</p>
      <ul class="list-disc pl-5 space-y-1">
        ${dependencyList}
      </ul>
      ${
        effectItems.length > 0
          ? `
            <div class="pt-1">
              <p class="font-medium text-slate-700">เมื่อลบแล้วระบบจะดำเนินการดังนี้</p>
              <ul class="mt-2 list-disc pl-5 space-y-1">
                ${effectList}
              </ul>
            </div>
          `
          : ""
      }
      <p class="pt-1">ต้องการลบข้อมูลต่อหรือไม่?</p>
    </div>
  `;
}

async function showSuccessAlert(title: string, text: string) {
  await Swal.fire({
    icon: "success",
    title,
    text,
    showConfirmButton: false,
    allowOutsideClick: false,
    allowEscapeKey: false,
    allowEnterKey: false,
    timer: 2000,
    timerProgressBar: false,
    customClass: {
      popup: "rounded-3xl border border-emerald-100 shadow-[0_24px_80px_rgba(15,23,42,0.14)]",
      title: "text-xl font-semibold text-slate-900",
      htmlContainer: "text-sm leading-6 text-slate-500",
    },
  });
}

async function askConfirm(
  title: string,
  text: string,
  confirmButtonText: string,
  confirmButtonColor: string,
) {
  const result = await Swal.fire({
    icon: "question",
    title,
    text,
    showCancelButton: true,
    confirmButtonText,
    cancelButtonText: "ยกเลิก",
    focusCancel: true,
    confirmButtonColor,
    cancelButtonColor: "#0369a1",
    customClass: {
      popup: "rounded-3xl border border-sky-100 shadow-[0_24px_80px_rgba(15,23,42,0.14)]",
      title: "text-xl font-semibold text-slate-900",
      htmlContainer: "text-sm leading-6 text-slate-500",
    },
  });
  return result.isConfirmed;
}

function getStatusFilterStyle(status: StatusFilter): React.CSSProperties {
  return status === "active"
    ? { backgroundColor: "#eff6ff", borderColor: "#93c5fd", color: "#1d4ed8", boxShadow: "0 8px 20px rgba(37, 99, 235, 0.08)" }
    : status === "inactive"
      ? { backgroundColor: "#f8fafc", borderColor: "#cbd5e1", color: "#334155", boxShadow: "0 8px 20px rgba(15, 23, 42, 0.06)" }
      : { backgroundColor: "#f8fbff", borderColor: "#bfdbfe", color: "#1e3a8a", boxShadow: "0 8px 20px rgba(37, 99, 235, 0.06)" };
}

function ToggleSwitch({
  checked,
  onChange,
  disabled,
  title,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <label className={`relative inline-flex items-center ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`} title={title}>
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={onChange} disabled={disabled} />
      <div className="relative h-5 w-10 rounded-full bg-slate-300 transition peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-100 peer-checked:bg-emerald-500 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all peer-checked:after:translate-x-full peer-checked:after:border-white" />
    </label>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      เปิดใช้งาน
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
      ปิดใช้งาน
    </span>
  );
}

function KpiCard({
  icon: Icon,
  title,
  value,
  cardClass,
  iconClass,
}: {
  icon: KpiIcon;
  title: string;
  value: number;
  cardClass: string;
  iconClass: string;
}) {
  return (
    <div className={`relative overflow-hidden rounded-3xl border p-5 backdrop-blur-sm transition-transform duration-200 hover:-translate-y-0.5 ${cardClass}`}>
      <div className="relative flex items-start gap-4">
        <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${iconClass} text-white shadow-[0_10px_24px_rgba(15,23,42,0.12)] ring-1 ring-white/35`} aria-hidden="true">
          <Icon className="h-6 w-6" strokeWidth={2.25} />
        </div>
        <div className="min-w-0 pt-0.5">
          <div className="text-sm font-medium text-slate-600">{title}</div>
          <div className="text-2xl font-black leading-tight tracking-tight text-slate-900">{value.toLocaleString("th-TH")}</div>
        </div>
      </div>
    </div>
  );
}

export default function AdminTimeSlotsPage() {
  const [items, setItems] = useState<TimeSlotRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ModalMode>("create");
  const [editing, setEditing] = useState<TimeSlotRow | null>(null);
  const [name, setName] = useState("");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("16:30");
  const [maxAttempts, setMaxAttempts] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);

  const load = async () => {
    const res = await apiGet<TimeSlotListRes>("/api/admin/time_slots");
    setItems(res.items ?? []);
  };

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError("");
        await load();
      } catch (e: unknown) {
        setError(getErrorMessage(e, "โหลดข้อมูลไม่สำเร็จ"));
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  useEffect(() => setCurrentPage(1), [q, statusFilter]);

  const counts = useMemo(() => {
    let active = 0;
    let inactive = 0;
    for (const row of items) {
      if (row.is_active) active += 1;
      else inactive += 1;
    }
    return { total: items.length, active, inactive };
  }, [items]);

  const filteredItems = useMemo(() => {
    let list = [...items];
    if (statusFilter === "active") list = list.filter((item) => item.is_active);
    if (statusFilter === "inactive") list = list.filter((item) => !item.is_active);
    const keyword = q.trim().toLowerCase();
    if (keyword) {
      list = list.filter((item) => [
        item.name,
        item.start_time,
        item.end_time,
        formatTimeStr(item.start_time),
        formatTimeStr(item.end_time),
        String(item.max_attempts),
      ].some((value) => value.toLowerCase().includes(keyword)));
    }
    return list;
  }, [items, q, statusFilter]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [filteredItems.length]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedItems = useMemo(() => {
    const start = (safeCurrentPage - 1) * PAGE_SIZE;
    return filteredItems.slice(start, start + PAGE_SIZE);
  }, [filteredItems, safeCurrentPage]);
  const startItem = filteredItems.length === 0 ? 0 : (safeCurrentPage - 1) * PAGE_SIZE + 1;

  const openCreate = () => {
    setMode("create");
    setEditing(null);
    setName("");
    setStartTime("08:00");
    setEndTime("16:30");
    setMaxAttempts(1);
    setError("");
    setOpen(true);
  };

  const openEdit = (row: TimeSlotRow) => {
    setMode("edit");
    setEditing(row);
    setName(row.name);
    setStartTime(row.start_time.substring(0, 5));
    setEndTime(row.end_time.substring(0, 5));
    setMaxAttempts(row.max_attempts);
    setError("");
    setOpen(true);
  };

  const closeModal = () => {
    setOpen(false);
    setEditing(null);
    setMode("create");
    setName("");
    setStartTime("08:00");
    setEndTime("16:30");
    setMaxAttempts(1);
  };

  const save = async () => {
    try {
      setError("");
      const payloadName = name.trim();
      if (!payloadName) throw new Error("กรุณากรอกชื่อช่วงเวลา");
      if (!startTime || !endTime) throw new Error("กรุณาระบุเวลาให้ครบถ้วน");
      if (startTime >= endTime) throw new Error("เวลาเริ่มต้นต้องก่อนเวลาสิ้นสุด");
      if (!Number.isFinite(maxAttempts) || maxAttempts < 1) throw new Error("กรุณาระบุจำนวนครั้งที่ตอบได้อย่างน้อย 1");

      const payload = { name: payloadName, start_time: `${startTime}:00`, end_time: `${endTime}:00`, max_attempts: maxAttempts };
      setBusy(true);
      const isCreate = mode === "create";

      if (isCreate) {
        await apiPost("/api/admin/time_slots", payload);
      } else {
        if (!editing) throw new Error("ไม่พบรายการที่ต้องแก้ไข");
        await apiPut(`/api/admin/time_slots/${editing.id}`, payload);
      }

      await load();
      closeModal();
      await showSuccessAlert(
        isCreate ? "เพิ่มช่วงเวลาสำเร็จ" : "แก้ไขช่วงเวลาสำเร็จ",
        isCreate ? `สร้างช่วงเวลา "${payloadName}" เรียบร้อยแล้ว` : `อัปเดตช่วงเวลา "${payloadName}" เรียบร้อยแล้ว`,
      );
    } catch (e: unknown) {
      setError(getErrorMessage(e, "บันทึกไม่สำเร็จ"));
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (row: TimeSlotRow) => {
    try {
      setError("");
      const nextActive = !row.is_active;
      const ok = await askConfirm(
        nextActive ? "เปิดใช้งานช่วงเวลา" : "ปิดใช้งานช่วงเวลา",
        nextActive ? `ต้องการเปิดใช้งานช่วงเวลา "${row.name}" ใช่ไหม?` : `ต้องการปิดใช้งานช่วงเวลา "${row.name}" ใช่ไหม?`,
        nextActive ? "เปิดใช้งาน" : "ปิดใช้งาน",
        nextActive ? "#2563eb" : "#dc2626",
      );
      if (!ok) return;
      setBusy(true);
      await apiPut(`/api/admin/time_slots/${row.id}/toggle-active`);
      await load();
      await showSuccessAlert(
        nextActive ? "เปิดใช้งานช่วงเวลาสำเร็จ" : "ปิดใช้งานช่วงเวลาสำเร็จ",
        `${nextActive ? "เปิดใช้งาน" : "ปิดใช้งาน"}ช่วงเวลา "${row.name}" เรียบร้อยแล้ว`,
      );
    } catch (e: unknown) {
      setError(getErrorMessage(e, "อัปเดตสถานะไม่สำเร็จ"));
    } finally {
      setBusy(false);
    }
  };

  const deleteSlot = async (row: TimeSlotRow) => {
    try {
      setError("");
      const ok = await askConfirm(
        "ลบช่วงเวลา",
        `ต้องการลบช่วงเวลา "${row.name}" ใช่ไหม?\nการกระทำนี้ไม่สามารถย้อนกลับได้`,
        "ลบข้อมูล",
        "#dc2626",
      );
      if (!ok) return;
      setBusy(true);
      let response = await apiDeleteWithMeta<TimeSlotDeleteResponse>(
        `/api/admin/time_slots/${row.id}`,
      );

      if (!response.ok) {
        if (
          response.status === 409 &&
          isTimeSlotDeleteResponse(response.data) &&
          response.data.requires_confirmation
        ) {
          setBusy(false);

          const confirmForce = await Swal.fire({
            icon: "warning",
            title: "พบข้อมูลอ้างอิงของช่วงเวลา",
            html: buildTimeSlotDependencyHtml(row.name, response.data),
            showCancelButton: true,
            confirmButtonText: "ยืนยันการลบข้อมูล",
            cancelButtonText: "ยกเลิก",
            focusCancel: true,
            confirmButtonColor: "#dc2626",
            cancelButtonColor: "#2563eb",
            customClass: {
              popup: "rounded-3xl border border-sky-100 shadow-[0_24px_80px_rgba(15,23,42,0.14)]",
              title: "text-xl font-semibold text-slate-900",
              htmlContainer: "text-sm leading-6 text-slate-500",
            },
          });

          if (!confirmForce.isConfirmed) return;

          setBusy(true);
          response = await apiDeleteWithMeta<TimeSlotDeleteResponse>(
            `/api/admin/time_slots/${row.id}?force=true`,
          );
        }

        if (!response.ok) {
          throw new Error(response.error ?? "ลบข้อมูลไม่สำเร็จ");
        }
      }

      const responseData = isTimeSlotDeleteResponse(response.data)
        ? response.data
        : null;

      await load();
      await showSuccessAlert(
        responseData?.recalculated
          ? "ลบช่วงเวลาและคำนวณผลใหม่สำเร็จ"
          : "ลบช่วงเวลาสำเร็จ",
        responseData?.recalculated
          ? `ลบช่วงเวลา "${row.name}" พร้อมล้างผลการประเมินที่เกี่ยวข้อง และคำนวณผลใหม่จากข้อมูลที่เหลือเรียบร้อยแล้ว`
          : `ลบช่วงเวลา "${row.name}" เรียบร้อยแล้ว`,
      );
    } catch (e: unknown) {
      setError(getErrorMessage(e, "ลบข้อมูลไม่สำเร็จ"));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-sky-50 via-white to-blue-50 p-6">
        <div className="pointer-events-none absolute -left-24 -top-32 h-80 w-80 rounded-full bg-sky-200/30 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 rounded-full bg-blue-200/20 blur-3xl" />
        <div className="relative z-10 mx-auto max-w-7xl space-y-4 animate-pulse">
          <div className="h-44 rounded-[28px] border border-sky-100/80 bg-white/90 shadow-[0_16px_40px_rgba(37,99,235,0.08)]" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[...Array(3)].map((_, i) => <div key={i} className="h-28 rounded-3xl border border-sky-100/80 bg-white/90 shadow-[0_16px_40px_rgba(37,99,235,0.08)]" />)}
          </div>
          <div className="h-28 rounded-3xl border border-sky-100/80 bg-white/90 shadow-[0_16px_40px_rgba(37,99,235,0.08)]" />
          <div className="h-80 rounded-3xl border border-sky-100/80 bg-white/90 shadow-[0_16px_40px_rgba(37,99,235,0.08)]" />
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-sky-50 via-white to-blue-50 p-6 text-slate-900">
      <div className="pointer-events-none absolute -left-24 -top-32 h-80 w-80 rounded-full bg-sky-200/30 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 rounded-full bg-blue-200/20 blur-3xl" />
      <div className="relative z-10 mx-auto max-w-7xl space-y-6">
        <div className="relative overflow-hidden rounded-[28px] border border-white/20 bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-600 p-6 text-white shadow-[0_24px_60px_rgba(37,99,235,0.20)]">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-16 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-sky-200/15 blur-3xl" />
          <div className="relative z-10 flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-4">
              <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-white/15 text-white ring-1 ring-white/20 backdrop-blur-md">
                <Clock3 className="h-7 w-7" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-sky-100/90">Administration</p>
                <h1 className="mt-1 text-2xl font-bold text-white">จัดการช่วงเวลาทำแบบสอบถาม</h1>                <div className="mt-4 h-1.5 w-20 rounded-full bg-white/25" />
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="flex items-start justify-between gap-3 rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm">
            <span className="whitespace-pre-wrap">{error}</span>
            <button type="button" onClick={() => setError("")} className="rounded-lg p-1 text-rose-500 transition hover:bg-rose-100 hover:text-rose-700" aria-label="ปิดข้อความแจ้งเตือน">
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <KpiCard icon={Clock3} title="ช่วงเวลาทั้งหมด" value={counts.total} cardClass={THEME.total.cardClass} iconClass={THEME.total.iconClass} />
          <KpiCard icon={CircleCheck} title="เปิดใช้งาน" value={counts.active} cardClass={THEME.active.cardClass} iconClass={THEME.active.iconClass} />
          <KpiCard icon={CircleX} title="ปิดใช้งาน" value={counts.inactive} cardClass={THEME.inactive.cardClass} iconClass={THEME.inactive.iconClass} />
        </div>

        <div className="rounded-3xl border border-sky-100/80 bg-white/90 p-5 shadow-[0_16px_40px_rgba(37,99,235,0.08)] backdrop-blur-sm">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-end">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">ค้นหา (ชื่อช่วงเวลา)</label>
              <input value={q} onChange={(e) => setQ(e.target.value)} className={inputClass} />
            </div>
            <div className="w-full sm:w-52">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">สถานะ</label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)} style={getStatusFilterStyle(statusFilter)} className={selectClass}>
                {STATUS_FILTERS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="flex justify-end pr-4 sm:pr-4">
          <button type="button" onClick={openCreate} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:from-sky-500 hover:to-blue-500 disabled:opacity-60" disabled={busy}>+ เพิ่มช่วงเวลา</button>
        </div>

        <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white/95 shadow-[0_18px_50px_rgba(37,99,235,0.08)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-full text-sm">
              <thead className="border-b border-blue-700/20 bg-gradient-to-r from-sky-600 to-blue-600 text-white">
                <tr>
                  <th className="w-[80px] px-4 py-3 text-center font-semibold">ลำดับ</th>
                  <th className="w-[300px] px-4 py-3 text-left font-semibold">ชื่อช่วงเวลา</th>
                  <th className="w-[120px] px-4 py-3 text-center font-semibold">เวลาเริ่มต้น</th>
                  <th className="w-[120px] px-4 py-3 text-center font-semibold">เวลาสิ้นสุด</th>
                  <th className="w-[170px] px-4 py-3 text-center font-semibold">จำนวนครั้งที่ตอบได้</th>
                  <th className="w-[140px] px-4 py-3 text-center font-semibold">สถานะ</th>
                  <th className="w-[240px] px-4 py-3 text-center font-semibold">การทำงาน</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedItems.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-slate-500" colSpan={7}>
                      {items.length === 0 ? "ยังไม่มีข้อมูลช่วงเวลา" : "ไม่พบข้อมูลช่วงเวลาที่ตรงกับเงื่อนไข"}
                    </td>
                  </tr>
                ) : (
                  paginatedItems.map((slot, idx) => (
                    <tr key={slot.id} className="transition hover:bg-slate-50">
                      <td className="px-4 py-3 text-center text-slate-500">{startItem + idx}</td>
                      <td className="w-[300px] px-4 py-3 font-medium text-slate-900"><div className="truncate">{slot.name}</div></td>
                      <td className="px-4 py-3 text-center font-medium text-slate-700">{formatTimeStr(slot.start_time)}</td>
                      <td className="px-4 py-3 text-center font-medium text-slate-700">{formatTimeStr(slot.end_time)}</td>
                      <td className="px-4 py-3 text-center text-slate-700">{slot.max_attempts} ครั้ง / 1 บัญชี</td>
                      <td className="px-4 py-3 text-center"><StatusBadge active={slot.is_active} /></td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <ToggleSwitch checked={slot.is_active} onChange={() => toggleActive(slot)} disabled={busy} title={slot.is_active ? "คลิกเพื่อปิดใช้งาน" : "คลิกเพื่อเปิดใช้งาน"} />
                          <div className="mx-1 h-5 w-px bg-slate-200" />
                          <button type="button" onClick={() => openEdit(slot)} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-100 disabled:opacity-50" disabled={busy}>แก้ไข</button>
                          <button type="button" onClick={() => deleteSlot(slot)} className="rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-50" disabled={busy}>ลบ</button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-end">
            <div className="flex items-center gap-2 sm:ml-auto">
              <button type="button" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={safeCurrentPage <= 1} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">ย้อนกลับ</button>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">หน้า {safeCurrentPage} / {totalPages}</div>
              <button type="button" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={safeCurrentPage >= totalPages} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">ถัดไป</button>
            </div>
          </div>
        </div>

        {open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4">
            <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white via-slate-50 to-sky-50 shadow-[0_24px_70px_rgba(15,23,42,0.18)]">
              <div className="relative rounded-t-3xl border-b border-white/15 bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-600 px-6 py-4 text-white">
                <button type="button" onClick={closeModal} disabled={busy} className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25 disabled:opacity-60" aria-label="ปิด" title="ปิด">
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
                <h3 className="text-lg font-bold">{mode === "create" ? "เพิ่มช่วงเวลา" : "แก้ไขช่วงเวลา"}</h3>
                <p className="mt-1 text-sm text-sky-100/90">กรอกชื่อช่วงเวลา เวลาเริ่มต้น เวลาสิ้นสุด และจำนวนครั้งที่ตอบได้</p>
              </div>

              <div className="p-6">
                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">ชื่อช่วงเวลา <span className="text-red-500">*</span></label>
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} autoFocus />
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">เวลาเริ่มต้น <span className="text-red-500">*</span></label>
                      <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputClass} />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">เวลาสิ้นสุด <span className="text-red-500">*</span></label>
                      <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={inputClass} />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">จำนวนครั้งที่ตอบได้ ต่อ 1 ท่าน <span className="text-red-500">*</span></label>
                    <input type="number" min="1" value={maxAttempts} onChange={(e) => setMaxAttempts(parseInt(e.target.value, 10) || 1)} className={inputClass} />
                  </div>
                </div>

                {error && <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

                <div className="mt-6 flex justify-end gap-2">
                  <button type="button" onClick={save} disabled={busy} className="rounded-xl bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-700 disabled:opacity-60">{busy ? "กำลังบันทึก..." : "บันทึกข้อมูล"}</button>
                  <button type="button" onClick={closeModal} disabled={busy} className="rounded-xl border border-slate-200 bg-red-500 px-4 py-2 text-white transition hover:bg-red-600 disabled:opacity-60">ยกเลิก</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
