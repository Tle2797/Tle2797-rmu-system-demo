"use client";

import { useEffect, useState, type ComponentType, type SVGProps } from "react";
import {
  CircleAlert,
  Building2,
  ClipboardList,
  Clock3,
  PieChart,
  RefreshCw,
  Users,
  X,
} from "lucide-react";
import { apiGet } from "@/lib/api";

/* ======================== Types ======================== */
type RatingBand = {
  id: number;
  min_value: number | string;
  max_value: number | string;
  label_th: string;
  sort_order: number;
};

type Stats = {
  users: { total: number; active: number; inactive: number };
  departments: { total: number; active: number; inactive: number };
  surveys: { total: number; active: number };
  time_slots: { total: number; active: number };
  responses: {
    total: number;
    student: number;
    staff: number;
    public: number;
    avg_rating: number | null;
    today: number;
  };
  recent_responses: Array<{
    id: number;
    respondent_group: string;
    submitted_at: string;
    department_name: string;
    survey_title: string;
  }>;
  no_data_departments: Array<{
    id: number;
    name: string;
    total_responses: number;
    avg_rating: number | null;
    issue_code: "no_data";
  }>;
  daily_trend: Array<{ day: string; count: number }>;
  rating_bands: RatingBand[];
};

/* ======================== Helpers ======================== */
const toNumLoose = (v: unknown): number => {
  if (v === null || v === undefined) return NaN;
  const s = String(v).trim().replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
};

/**
 * แปลงผลคะแนนเฉลี่ยด้วย rating_bands จาก DB
 */
function resolveLabel(avg: number | null, bands: RatingBand[]): string {
  if (!avg || !Number.isFinite(avg) || bands.length === 0) return "ยังไม่มีข้อมูล";
  const clamped = Math.max(0, Math.min(5, avg));
  const v = Number(clamped.toFixed(1));

  const ordered = [...bands].sort((a, b) => Number(a.sort_order) - Number(b.sort_order));
  const found = ordered.find((b) => {
    const min = toNumLoose(b.min_value);
    const max = toNumLoose(b.max_value);
    return Number.isFinite(min) && Number.isFinite(max) && v >= min && v <= max;
  });
  if (found) return found.label_th;

  // fallback: หาช่วงที่ใกล้ที่สุด
  const byMax = [...ordered].sort((a, b) => toNumLoose(a.max_value) - toNumLoose(b.max_value));
  return byMax.find((b) => v <= toNumLoose(b.max_value))?.label_th ?? "ไม่ทราบเกณฑ์";
}

const groupLabel: Record<string, string> = {
  student: "นักศึกษา",
  staff: "บุคลากร",
  public: "บุคคลทั่วไป",
};

const groupColor: Record<string, string> = {
  student: "bg-sky-500",
  staff: "bg-emerald-500",
  public: "bg-blue-500",
};

type KpiIcon = ComponentType<SVGProps<SVGSVGElement>>;

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("th-TH", {
      day: "2-digit",
      month: "short",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatDayLabel(iso: string): string {
  try {
    const value =
      /^\d{4}-\d{2}-\d{2}$/.test(iso)
        ? new Date(`${iso}T12:00:00+07:00`)
        : new Date(iso);

    return value.toLocaleDateString("th-TH", {
      weekday: "short",
      timeZone: "Asia/Bangkok",
    });
  } catch {
    return iso;
  }
}

/* ======================== Sub-components ======================== */
function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  cardClass = "border-slate-200/80 bg-white/90 shadow-[0_16px_40px_rgba(37,99,235,0.08)]",
  iconClass = "from-blue-500 to-blue-600",
}: {
  icon: KpiIcon;
  label: string;
  value: number | string;
  sub?: string;
  cardClass?: string;
  iconClass?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-3xl border p-5 backdrop-blur-sm transition-transform duration-200 hover:-translate-y-0.5 ${cardClass}`}
    >
      <div className="relative flex items-start gap-4">
        <div
          className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${iconClass} text-white shadow-[0_10px_24px_rgba(15,23,42,0.12)] ring-1 ring-white/35`}
          aria-hidden="true"
        >
          <Icon className="h-6 w-6" strokeWidth={2.25} />
        </div>
        <div className="min-w-0 pt-0.5">
          <div className="text-sm font-medium text-slate-600">{label}</div>
          <div className="text-2xl font-black leading-tight tracking-tight text-slate-900">
            {value}
          </div>
          {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
        </div>
      </div>
    </div>
  );
}

const KPI_THEMES = {
  users: {
    cardClass: "border-slate-200/80 bg-white/95 shadow-[0_12px_30px_rgba(15,23,42,0.06)]",
    iconClass: "from-sky-500 to-cyan-500",
  },
  departments: {
    cardClass: "border-slate-200/80 bg-white/95 shadow-[0_12px_30px_rgba(15,23,42,0.06)]",
    iconClass: "from-emerald-500 to-teal-500",
  },
  surveys: {
    cardClass: "border-slate-200/80 bg-white/95 shadow-[0_12px_30px_rgba(15,23,42,0.06)]",
    iconClass: "from-violet-500 to-indigo-500",
  },
  timeSlots: {
    cardClass: "border-slate-200/80 bg-white/95 shadow-[0_12px_30px_rgba(15,23,42,0.06)]",
    iconClass: "from-amber-500 to-orange-500",
  },
} as const;

type TrendChartPoint = {
  day: string;
  label: string;
  count: number;
  isToday: boolean;
};

function MiniBarChart({ data }: { data: Array<{ day: string; count: number }> }) {
  const chartData: TrendChartPoint[] = data.map((d, i) => ({
    day: d.day,
    label: formatDayLabel(d.day),
    count: d.count,
    isToday: i === data.length - 1,
  }));

  if (chartData.length === 0) {
    return <div className="flex h-72 items-center justify-center text-sm text-slate-400">ยังไม่มีข้อมูล</div>;
  }

  const max = Math.max(...chartData.map((d) => d.count), 1);

  return (
    <div className="flex h-72 items-end gap-3 rounded-2xl border border-sky-100/80 bg-gradient-to-b from-sky-50/70 to-white px-4 pb-4 pt-6">
      {chartData.map((entry) => {
        const height = Math.max(16, (entry.count / max) * 160);
        return (
          <div key={entry.day} className="flex flex-1 flex-col items-center">
            <div className="mb-2 flex h-4 items-center justify-center text-xs font-semibold tabular-nums leading-none text-slate-700">
              {entry.count.toLocaleString("th-TH")}
            </div>
            <div className="flex h-52 w-full items-end justify-center">
              <div
                className={`w-full max-w-10 rounded-t-xl bg-gradient-to-t ${
                  entry.isToday ? "from-sky-600 to-blue-500" : "from-sky-400 to-sky-300"
                } shadow-sm`}
                style={{ height: `${height}px` }}
              />
            </div>
            <div className="mt-2 text-xs text-slate-500">{entry.label}</div>
            <div className="mt-0.5 h-[10px]" />
          </div>
        );
      })}
    </div>
  );
}

/* ======================== Main Page ======================== */
export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshed, setRefreshed] = useState<Date | null>(null);
  const [showNoDataDialog, setShowNoDataDialog] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await apiGet<Stats>("/api/admin/dashboard/stats");
      setStats(data);
      setRefreshed(new Date());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);


  if (loading) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-sky-50 via-white to-blue-50 p-6">
        <div className="pointer-events-none absolute -top-32 -left-24 h-80 w-80 rounded-full bg-sky-200/30 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 rounded-full bg-blue-200/20 blur-3xl" />
        <div className="relative z-10 mx-auto max-w-7xl space-y-4 animate-pulse">
          <div className="h-44 rounded-3xl border border-sky-100/80 bg-white/90 shadow-[0_16px_40px_rgba(37,99,235,0.08)]" />
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-24 rounded-2xl border border-sky-100/80 bg-white/90 shadow-[0_16px_40px_rgba(37,99,235,0.08)]"
              />
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="h-56 rounded-2xl border border-sky-100/80 bg-white/90 shadow-[0_16px_40px_rgba(37,99,235,0.08)]" />
            <div className="h-56 rounded-2xl border border-sky-100/80 bg-white/90 shadow-[0_16px_40px_rgba(37,99,235,0.08)]" />
          </div>
        </div>
      </main>
    );
  }

  if (error || !stats) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-sky-50 via-white to-blue-50 p-6">
        <div className="pointer-events-none absolute -top-32 -left-24 h-80 w-80 rounded-full bg-sky-200/30 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 rounded-full bg-blue-200/20 blur-3xl" />
        <div className="relative z-10 mx-auto max-w-7xl rounded-3xl border border-sky-100/80 bg-white/90 p-8 text-center shadow-[0_16px_40px_rgba(37,99,235,0.08)] backdrop-blur-sm">
          <CircleAlert className="mx-auto mb-3 h-12 w-12 text-rose-600" aria-hidden="true" />
          <p className="font-medium text-red-600">{error || "ไม่สามารถโหลดข้อมูลได้"}</p>
          <button
            onClick={load}
            className="mt-4 rounded-lg bg-gradient-to-r from-sky-600 to-blue-600 px-4 py-2 text-sm text-white transition-colors hover:from-sky-500 hover:to-blue-500"
          >
            ลองใหม่
          </button>
        </div>
      </main>
    );
  }

  const {
    users,
    departments,
    surveys,
    time_slots,
    responses,
    recent_responses,
    no_data_departments,
    daily_trend,
    rating_bands,
  } = stats;

  // ใช้ rating_bands จาก DB แทน hardcode
  const avgRating = responses.avg_rating ? Number(responses.avg_rating) : null;
  const noDataPreview = no_data_departments.slice(0, 5);
  const totalResponses = Math.max(responses.total, 1);
  const respondentSegments = [
    { label: "นักศึกษา", value: responses.student, color: "#0ea5e9" },
    { label: "บุคลากร", value: responses.staff, color: "#10b981" },
    { label: "บุคคลทั่วไป", value: responses.public, color: "#2563eb" },
  ];

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-sky-50 via-white to-blue-50 p-6 text-slate-900">
      <div className="pointer-events-none absolute -top-32 -left-24 h-80 w-80 rounded-full bg-sky-200/30 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 rounded-full bg-blue-200/20 blur-3xl" />
      <div className="relative z-10 mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="relative overflow-hidden rounded-[28px] border border-white/20 bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-600 p-6 text-white shadow-[0_24px_60px_rgba(37,99,235,0.20)]">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-16 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-sky-200/15 blur-3xl" />
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="mt-0.5 text-2xl font-bold">แดชบอร์ดภาพรวม</h1>
              <p className="mt-1 text-sm text-sky-100/90">
                ระบบแบบสอบถามความพึงพอใจ มหาวิทยาลัยราชภัฏมหาสารคาม
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <button
                onClick={load}
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm font-medium text-white backdrop-blur-md transition-colors hover:bg-white/20"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                รีเฟรช
              </button>
              {refreshed && (
                <span className="text-xs text-sky-100/80">
                  อัปเดต:{" "}
                  {refreshed.toLocaleTimeString("th-TH", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  น.
                </span>
              )}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-white/15 bg-white/10 p-3 text-center backdrop-blur-md">
              <div className="text-3xl font-bold">{responses.today.toLocaleString("th-TH")}</div>
              <div className="mt-0.5 text-xs text-sky-100/80">การตอบวันนี้</div>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 p-3 text-center backdrop-blur-md">
              <div className="text-3xl font-bold">{responses.total.toLocaleString("th-TH")}</div>
              <div className="mt-0.5 text-xs text-sky-100/80">การตอบทั้งหมด</div>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 p-3 text-center backdrop-blur-md">
              <div className="text-3xl font-bold">{avgRating ? avgRating.toFixed(2) : "-"}</div>
              <div className="mt-0.5 text-xs text-sky-100/80">
                {avgRating ? `ผลการประเมิน: ${resolveLabel(avgRating, rating_bands)}` : "ยังไม่มีคะแนนเฉลี่ย"}
              </div>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 p-3 text-center backdrop-blur-md">
              <div className="text-3xl font-bold">{surveys.active}</div>
              <div className="mt-0.5 text-xs text-sky-100/80">แบบสอบถามที่ใช้งาน</div>
            </div>
          </div>
        </div>

          {/* KPI Row */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              icon={Users}
              label="ผู้ใช้ระบบ"
              value={users.total}
              cardClass={KPI_THEMES.users.cardClass}
              iconClass={KPI_THEMES.users.iconClass}
            />
            <KpiCard
              icon={Building2}
              label="หน่วยงาน"
              value={departments.total}
              cardClass={KPI_THEMES.departments.cardClass}
              iconClass={KPI_THEMES.departments.iconClass}
            />
            <KpiCard
              icon={ClipboardList}
              label="แบบสอบถามทั้งหมด"
              value={surveys.total}
              cardClass={KPI_THEMES.surveys.cardClass}
              iconClass={KPI_THEMES.surveys.iconClass}
            />
            <KpiCard
              icon={Clock3}
              label="ช่วงเวลา"
              value={time_slots.total}
              cardClass={KPI_THEMES.timeSlots.cardClass}
              iconClass={KPI_THEMES.timeSlots.iconClass}
            />
          </div>

        {/* Charts Row */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-sky-100/80 bg-white/90 p-5 shadow-[0_16px_40px_rgba(37,99,235,0.08)] backdrop-blur-sm">
            <h2 className="font-bold text-slate-900 mb-3">กราฟการตอบแบบสอบถาม</h2>
            <MiniBarChart data={daily_trend} />
          </div>

          <section className="rounded-2xl border border-sky-100/80 bg-white/90 p-5 shadow-[0_16px_40px_rgba(37,99,235,0.08)]">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-sky-500 text-white shadow-[0_10px_22px_rgba(14,165,233,0.18)]">
                <PieChart className="h-5 w-5" />
              </div>
              <h2 className="font-bold text-slate-900">สัดส่วนผู้ตอบตามกลุ่ม</h2>
            </div>
            <div className="mt-5 space-y-3">
              {respondentSegments.map((segment) => {
                const pct = (segment.value / totalResponses) * 100;
                return (
                  <div key={segment.label} className="rounded-2xl border border-sky-100 bg-sky-50/60 p-4">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: segment.color }} />
                        <span className="text-slate-700">{segment.label}</span>
                      </div>
                      <span className="font-semibold text-slate-900">{segment.value.toLocaleString("th-TH")} คน</span>
                    </div>
                    <div className="mt-3 h-3 overflow-hidden rounded-full bg-white">
                      <div className="h-3 rounded-full" style={{ width: `${pct}%`, backgroundColor: segment.color }} />
                    </div>
                    <div className="mt-2 text-xs text-slate-500">{pct.toFixed(1)}% ของผู้ตอบทั้งหมด</div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* Bottom Row */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-sky-100/80 bg-white/90 p-5 shadow-[0_16px_40px_rgba(37,99,235,0.08)] backdrop-blur-sm">
            <h2 className="mb-3 font-bold text-slate-900"> การตอบแบบสอบถามล่าสุด</h2>
            {recent_responses.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-400">ยังไม่มีข้อมูล</div>
            ) : (
              <div className="space-y-2">
                {recent_responses.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-start gap-3 rounded-xl p-2.5 transition hover:bg-sky-50/80"
                  >
                    <div
                      className={`mt-1.5 h-2.5 w-2.5 flex-shrink-0 rounded-full ${
                        groupColor[r.respondent_group] ?? "bg-slate-400"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-slate-900">
                        {r.department_name}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                        <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[10px] text-sky-700">
                          {groupLabel[r.respondent_group] ?? r.respondent_group}
                        </span>
                        <span>•</span>
                        <span>{formatTime(r.submitted_at)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-sky-100/80 bg-white/90 p-5 shadow-[0_16px_40px_rgba(37,99,235,0.08)] backdrop-blur-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-orange-500 text-white shadow-[0_10px_22px_rgba(244,63,94,0.18)]">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-900">หน่วยงานที่ยังไม่มีข้อมูล</h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    ทั้งหมด {no_data_departments.length.toLocaleString("th-TH")} หน่วยงาน
                  </p>
                </div>
              </div>
              {no_data_departments.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setShowNoDataDialog(true)}
                  className="rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-2 text-sm font-medium text-sky-700 transition hover:border-sky-300 hover:bg-sky-100 focus:outline-none focus:ring-4 focus:ring-sky-100"
                >
                  ดูทั้งหมด
                </button>
              ) : null}
            </div>
            <div className="mt-4 space-y-3">
              {noDataPreview.length === 0 ? (
                <div className="rounded-2xl border border-sky-100 bg-sky-50/50 px-4 py-8 text-center text-sm text-slate-400">
                  ทุกหน่วยงานมีข้อมูลแล้ว
                </div>
              ) : (
                noDataPreview.map((department) => (
                  <div
                    key={department.id}
                    className="rounded-2xl border border-sky-100 bg-gradient-to-r from-white to-sky-50/60 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-900">
                          {department.name}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">ยังไม่มีผู้ตอบ</div>
                      </div>
                      <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700">
                        ยังไม่มีข้อมูล
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
      {showNoDataDialog ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="no-data-dialog-title"
          onClick={() => setShowNoDataDialog(false)}
        >
          <div
            className="w-full max-w-2xl overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.24)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-sky-100 px-5 py-4">
              <div>
                <h3 id="no-data-dialog-title" className="text-lg font-bold text-slate-900">
                  หน่วยงานที่ยังไม่มีข้อมูล
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  พบทั้งหมด {no_data_departments.length.toLocaleString("th-TH")} หน่วยงาน
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowNoDataDialog(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-sky-50 hover:text-slate-900"
                aria-label="ปิด"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="max-h-[65vh] overflow-y-auto p-5">
              <div className="grid gap-2 sm:grid-cols-2">
                {no_data_departments.map((department, index) => (
                  <div
                    key={department.id}
                    className="flex items-center gap-3 rounded-xl border border-sky-100 bg-sky-50/50 px-3 py-2.5"
                  >
                    <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-sky-700">
                      {index + 1}
                    </span>
                    <span className="min-w-0 truncate text-sm font-medium text-slate-800">
                      {department.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
