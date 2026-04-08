"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ComponentType, type CSSProperties, type SVGProps } from "react";
import {
  Building2,
  CircleAlert,
  CircleCheck,
  CircleX,
  QrCode,
  Search,
} from "lucide-react";
import { apiGet } from "@/lib/api";

type DepartmentRow = {
  id: number;
  name: string;
  is_active: boolean;
  qrcode_id: number | null;
  qr_image_path: string | null;
  qr_link_target: string | null;
  qr_created_at: string | null;
  created_at?: string;
  updated_at?: string;
};

type DepartmentsResponse = {
  total: number;
  items: DepartmentRow[];
};

type StatusFilter = "all" | "active" | "inactive";
type KpiIcon = ComponentType<SVGProps<SVGSVGElement>>;

const selectClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-800 shadow-sm outline-none transition hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-100 disabled:cursor-not-allowed disabled:bg-slate-50";

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-800 placeholder:text-slate-400 shadow-sm outline-none transition hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-100 disabled:cursor-not-allowed disabled:bg-slate-50";

const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "ทั้งหมด" },
  { value: "active", label: "ใช้งานอยู่" },
  { value: "inactive", label: "ปิดใช้งาน" },
];

const SUMMARY_THEMES = {
  total: {
    cardClass:
      "border-slate-200/80 bg-white/95 shadow-[0_16px_40px_rgba(37,99,235,0.08)]",
    iconClass: "from-sky-500 to-cyan-500",
  },
  active: {
    cardClass:
      "border-slate-200/80 bg-white/95 shadow-[0_16px_40px_rgba(37,99,235,0.08)]",
    iconClass: "from-emerald-500 to-teal-500",
  },
  inactive: {
    cardClass:
      "border-slate-200/80 bg-white/95 shadow-[0_16px_40px_rgba(37,99,235,0.08)]",
    iconClass: "from-slate-500 to-slate-600",
  },
  qrReady: {
    cardClass:
      "border-slate-200/80 bg-white/95 shadow-[0_16px_40px_rgba(37,99,235,0.08)]",
    iconClass: "from-violet-500 to-fuchsia-500",
  },
} as const;

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message || fallback;
  if (typeof error === "string" && error.trim()) return error;
  return fallback;
}

function getStatusFilterStyle(status: StatusFilter): CSSProperties {
  if (status === "active") {
    return {
      backgroundColor: "#eff6ff",
      borderColor: "#93c5fd",
      color: "#1d4ed8",
      boxShadow: "0 8px 20px rgba(37, 99, 235, 0.08)",
    };
  }

  if (status === "inactive") {
    return {
      backgroundColor: "#f8fafc",
      borderColor: "#cbd5e1",
      color: "#334155",
      boxShadow: "0 8px 20px rgba(15, 23, 42, 0.06)",
    };
  }

  return {
    backgroundColor: "#f8fbff",
    borderColor: "#bfdbfe",
    color: "#1e3a8a",
    boxShadow: "0 8px 20px rgba(37, 99, 235, 0.06)",
  };
}

function KpiCard({
  icon: Icon,
  title,
  value,
  sub,
  cardClass = "border-slate-200/80 bg-white/95 shadow-[0_16px_40px_rgba(37,99,235,0.08)]",
  iconClass = "from-sky-500 to-blue-600",
}: {
  icon: KpiIcon;
  title: string;
  value: number | string;
  sub?: string;
  cardClass?: string;
  iconClass?: string;
}) {
  return (
    <div
      className={`relative min-h-[112px] overflow-hidden rounded-[28px] border p-5 backdrop-blur-sm transition-transform duration-200 hover:-translate-y-0.5 ${cardClass}`}
    >
      <div className="relative flex items-center gap-4">
        <div
          className={`flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${iconClass} text-white shadow-[0_10px_24px_rgba(15,23,42,0.12)] ring-1 ring-white/35`}
          aria-hidden="true"
        >
          <Icon className="h-6 w-6" strokeWidth={2.25} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium leading-5 text-slate-600">{title}</div>
          <div className="mt-1 text-3xl font-black leading-none tracking-tight text-slate-900">
            {typeof value === "number" ? value.toLocaleString("th-TH") : value}
          </div>
          {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      ใช้งานอยู่
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
      ปิดใช้งาน
    </span>
  );
}

function DepartmentCard({ department }: { department: DepartmentRow }) {
  return (
    <Link
      href={`/admin/questions/departments/${department.id}`}
      className="group block rounded-2xl border border-slate-200 bg-white p-4 transition duration-200 hover:-translate-y-0.5 hover:border-sky-200 hover:bg-sky-50/60 hover:shadow-[0_14px_24px_rgba(37,99,235,0.08)]"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-[0_10px_22px_rgba(37,99,235,0.16)]">
          <Building2 className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="whitespace-normal break-words text-sm font-semibold leading-5 text-slate-900">
                {department.name}
              </div>
            </div>
            <StatusBadge active={department.is_active} />
          </div>
        </div>
      </div>
    </Link>
  );
}

function LoadingSkeleton() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-sky-50 via-white to-blue-50 p-6 text-slate-900">
      <div className="pointer-events-none absolute -left-24 -top-32 h-80 w-80 rounded-full bg-sky-200/30 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 rounded-full bg-blue-200/20 blur-3xl" />

      <div className="relative z-10 mx-auto max-w-7xl space-y-6 animate-pulse">
        <div className="h-44 rounded-[28px] border border-white/70 bg-white/90 shadow-[0_24px_60px_rgba(37,99,235,0.08)]" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[...Array(4)].map((_, index) => (
            <div
              key={`summary-skeleton-${index}`}
              className="h-[112px] rounded-[24px] border border-white/70 bg-white/90 shadow-[0_16px_40px_rgba(37,99,235,0.08)]"
            />
          ))}
        </div>
        <div className="h-24 rounded-[28px] border border-white/70 bg-white/90 shadow-[0_16px_40px_rgba(37,99,235,0.08)]" />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[...Array(6)].map((_, index) => (
            <div
              key={`department-skeleton-${index}`}
              className="h-28 rounded-2xl border border-white/70 bg-white/90 shadow-[0_16px_40px_rgba(37,99,235,0.08)]"
            />
          ))}
        </div>
      </div>
    </main>
  );
}

export default function AdminDepartmentQuestionsPage() {
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        setLoading(true);
        setError("");
        const res = await apiGet<DepartmentsResponse>("/api/admin/departments?include_qr=1");
        if (!active) return;
        setDepartments(res.items ?? []);
      } catch (err: unknown) {
        if (!active) return;
        setDepartments([]);
        setError(getErrorMessage(err, "โหลดรายชื่อหน่วยงานไม่สำเร็จ"));
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const filteredDepartments = useMemo(() => {
    let list = departments;

    const keyword = query.trim().toLowerCase();
    if (keyword) {
      list = list.filter((department) => department.name.toLowerCase().includes(keyword));
    }

    if (statusFilter === "active") {
      list = list.filter((department) => department.is_active);
    }

    if (statusFilter === "inactive") {
      list = list.filter((department) => !department.is_active);
    }

    return list;
  }, [departments, query, statusFilter]);

  const total = departments.length;
  const activeCount = departments.filter((department) => department.is_active).length;
  const inactiveCount = Math.max(0, total - activeCount);
  const qrReadyCount = departments.filter((department) => department.qrcode_id).length;

  if (loading && departments.length === 0 && !error) {
    return <LoadingSkeleton />;
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-sky-50 via-white to-blue-50 p-6 text-slate-900">
      <div className="pointer-events-none absolute -left-24 -top-32 h-80 w-80 rounded-full bg-sky-200/30 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 rounded-full bg-blue-200/20 blur-3xl" />

      <div className="relative z-10 mx-auto max-w-7xl space-y-6">
        <section className="relative overflow-hidden rounded-[28px] border border-white/20 bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-600 p-6 text-white shadow-[0_24px_60px_rgba(37,99,235,0.20)]">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-16 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-sky-200/15 blur-3xl" />

          <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-4">
              <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-white/15 text-white ring-1 ring-white/20 backdrop-blur-md">
                <Building2 className="h-7 w-7" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-sky-100/90">Administration</p>
                <h1 className="mt-1 text-2xl font-bold text-white">
                  ตรวจสอบคำถามหน่วยงาน
                </h1>
                <div className="mt-4 h-1.5 w-20 rounded-full bg-white/25" />
              </div>
            </div>
          </div>
        </section>

        {error && (
          <div className="flex items-start justify-between gap-3 rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm">
            <div className="flex items-start gap-3">
              <CircleAlert className="mt-0.5 h-4 w-4 flex-shrink-0 text-rose-500" />
              <span className="whitespace-pre-wrap">{error}</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            icon={Building2}
            title="หน่วยงานทั้งหมด"
            value={total}
            cardClass={SUMMARY_THEMES.total.cardClass}
            iconClass={SUMMARY_THEMES.total.iconClass}
          />
          <KpiCard
            icon={CircleCheck}
            title="ใช้งานอยู่"
            value={activeCount}
            cardClass={SUMMARY_THEMES.active.cardClass}
            iconClass={SUMMARY_THEMES.active.iconClass}
          />
          <KpiCard
            icon={CircleX}
            title="ปิดใช้งาน"
            value={inactiveCount}
            cardClass={SUMMARY_THEMES.inactive.cardClass}
            iconClass={SUMMARY_THEMES.inactive.iconClass}
          />
          <KpiCard
            icon={QrCode}
            title="มี QR Code"
            value={qrReadyCount}
            cardClass={SUMMARY_THEMES.qrReady.cardClass}
            iconClass={SUMMARY_THEMES.qrReady.iconClass}
          />
        </div>

        <section className="overflow-hidden rounded-[28px] border border-white/70 bg-white/90 shadow-[0_18px_45px_rgba(37,99,235,0.08)] backdrop-blur-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
            <div>
              <h2 className="text-lg font-black text-slate-900">รายชื่อหน่วยงาน</h2>
            </div>
            <div className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700">
              {filteredDepartments.length.toLocaleString("th-TH")} รายการ
            </div>
          </div>

        <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 sm:px-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="grid w-full gap-4 lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-end">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  ค้นหาหน่วยงาน
                </label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    className={`${inputClass} pl-9`}
                    placeholder="พิมพ์ชื่อหน่วยงาน"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  สถานะ
                </label>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                  style={getStatusFilterStyle(statusFilter)}
                  className={selectClass}
                >
                  {STATUS_FILTERS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="px-5 pb-5 sm:px-6">
            {loading && departments.length === 0 ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {[...Array(6)].map((_, index) => (
                  <div
                    key={`department-card-skeleton-${index}`}
                    className="h-28 rounded-2xl border border-slate-200 bg-slate-50"
                  />
                ))}
              </div>
            ) : filteredDepartments.length === 0 ? (
              <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center">
                <div className="max-w-xs">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div className="mt-4 text-base font-semibold text-slate-900">
                    {query.trim()
                      ? "ไม่พบหน่วยงานที่ค้นหา"
                      : "ไม่พบหน่วยงานตามตัวกรองนี้"}
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {filteredDepartments.map((department) => (
                  <DepartmentCard key={department.id} department={department} />
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
