"use client";

import Link from "next/link";
import { useEffect, useState, type ComponentType, type SVGProps } from "react";
import {
  Building2,
  CircleAlert,
  Gauge,
  LineChart,
  MessageSquareText,
  PieChart,
  RefreshCw,
  ShieldAlert,
  Trophy,
} from "lucide-react";
import { apiGet } from "@/lib/api";

type RatingBand = {
  id: number;
  min_value: number | string;
  max_value: number | string;
  label_th: string;
  sort_order: number;
};

type DepartmentSnapshot = {
  id: number;
  name: string;
  total_responses: number;
  avg_rating: number | null;
};

type AttentionDepartment = DepartmentSnapshot & {
  issue_code: "no_data" | "low_response" | "low_score" | "watch";
};

type Stats = {
  active_survey: {
    count: number;
    title: string | null;
    year_be: number | null;
    titles: string[];
  };
  responses: {
    total: number;
    student: number;
    staff: number;
    public: number;
    avg_rating: number | null;
    today: number;
  };
  coverage: {
    active_departments: number;
    departments_with_responses: number;
    departments_without_responses: number;
    low_response_departments: number;
    low_response_threshold: number;
  };
  top_departments: DepartmentSnapshot[];
  attention_departments: AttentionDepartment[];
  daily_trend: Array<{ day: string; count: number }>;
  rating_bands: RatingBand[];
};

type KpiIcon = ComponentType<SVGProps<SVGSVGElement>>;

const groupColors = {
  student: "#0ea5e9",
  staff: "#10b981",
  public: "#2563eb",
} as const;

const toNumLoose = (value: unknown): number => {
  if (value === null || value === undefined) return Number.NaN;
  const parsed = Number(String(value).trim().replace(",", "."));
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

function resolveLabel(avg: number | null, bands: RatingBand[]): string {
  if (!avg || !Number.isFinite(avg) || bands.length === 0) return "ยังไม่มีข้อมูล";
  const value = Number(Math.max(0, Math.min(5, avg)).toFixed(1));
  const ordered = [...bands].sort((a, b) => Number(a.sort_order) - Number(b.sort_order));
  const found = ordered.find((band) => {
    const min = toNumLoose(band.min_value);
    const max = toNumLoose(band.max_value);
    return Number.isFinite(min) && Number.isFinite(max) && value >= min && value <= max;
  });
  if (found) return found.label_th;
  return ordered.find((band) => value <= toNumLoose(band.max_value))?.label_th ?? "ไม่ทราบเกณฑ์";
}

function resolveBandStyle(avg: number | null, bands: RatingBand[]) {
  if (!avg || !Number.isFinite(avg) || bands.length === 0) {
    return { textClass: "text-sky-500", bgClass: "bg-sky-50 text-sky-700 border-sky-200" };
  }
  const value = Number(Math.max(0, Math.min(5, avg)).toFixed(1));
  const ordered = [...bands].sort((a, b) => Number(a.sort_order) - Number(b.sort_order));
  const maxOrder = Math.max(...ordered.map((band) => Number(band.sort_order)));
  const minOrder = Math.min(...ordered.map((band) => Number(band.sort_order)));
  const found = ordered.find((band) => {
    const min = toNumLoose(band.min_value);
    const max = toNumLoose(band.max_value);
    return Number.isFinite(min) && Number.isFinite(max) && value >= min && value <= max;
  });
  if (!found) return { textClass: "text-sky-500", bgClass: "bg-sky-50 text-sky-700 border-sky-200" };
  const pct = (Number(found.sort_order) - minOrder) / (maxOrder - minOrder || 1);
  if (pct >= 0.75) return { textClass: "text-emerald-600", bgClass: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  if (pct >= 0.5) return { textClass: "text-blue-600", bgClass: "bg-blue-50 text-blue-700 border-blue-200" };
  if (pct >= 0.25) return { textClass: "text-yellow-600", bgClass: "bg-yellow-50 text-yellow-700 border-yellow-200" };
  return { textClass: "text-red-600", bgClass: "bg-red-50 text-red-700 border-red-200" };
}

function formatSurveyLabel(activeSurvey: Stats["active_survey"]) {
  if (activeSurvey.count <= 0) return "ยังไม่มีแบบประเมินที่เปิดอยู่";
  if (activeSurvey.count === 1 && activeSurvey.title) {
    return activeSurvey.year_be ? `${activeSurvey.title} (ปี ${activeSurvey.year_be})` : activeSurvey.title;
  }
  return `มีแบบประเมินที่เปิดอยู่ ${activeSurvey.count} ชุด`;
}

function formatDayLabel(iso: string) {
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

function getIssueMeta(code: AttentionDepartment["issue_code"], threshold: number) {
  if (code === "no_data") {
    return { label: "ยังไม่มีข้อมูล", desc: "ยังไม่มีผู้ตอบ", badge: "bg-rose-50 text-rose-700 border-rose-200" };
  }
  if (code === "low_response") {
    return { label: "ผู้ตอบน้อย", desc: `ผู้ตอบน้อยกว่า ${threshold} คน`, badge: "bg-amber-50 text-amber-700 border-amber-200" };
  }
  if (code === "low_score") {
    return { label: "คะแนนต่ำ", desc: "คะแนนเฉลี่ยค่อนข้างต่ำ", badge: "bg-orange-50 text-orange-700 border-orange-200" };
  }
  return { label: "ติดตามต่อ", desc: "ควรดูต่อเนื่อง", badge: "bg-sky-50 text-sky-700 border-sky-200" };
}

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  iconClass,
}: {
  icon: KpiIcon;
  label: string;
  value: string;
  sub?: string;
  iconClass: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white/95 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
      <div className="flex items-start gap-4">
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${iconClass} text-white shadow-[0_10px_24px_rgba(15,23,42,0.12)]`}>
          <Icon className="h-6 w-6" strokeWidth={2.25} />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium text-slate-600">{label}</div>
          <div className="text-2xl font-black leading-tight tracking-tight text-slate-900">{value}</div>
          {sub ? <div className="mt-1 text-xs text-slate-500">{sub}</div> : null}
        </div>
      </div>
    </div>
  );
}

export default function ExecDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshed, setRefreshed] = useState<Date | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await apiGet<Stats>("/api/exec/dashboard/stats");
      setStats(data);
      setRefreshed(new Date());
    } catch (errorValue: unknown) {
      setError(errorValue instanceof Error ? errorValue.message : "โหลดข้อมูลไม่สำเร็จ");
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
        <div className="relative z-10 mx-auto max-w-7xl space-y-4 animate-pulse">
          <div className="h-44 rounded-3xl border border-sky-100/80 bg-white/90 shadow-[0_16px_40px_rgba(37,99,235,0.08)]" />
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">{[...Array(4)].map((_, i) => <div key={i} className="h-24 rounded-2xl border border-sky-100/80 bg-white/90 shadow-[0_16px_40px_rgba(37,99,235,0.08)]" />)}</div>
          <div className="grid gap-4 md:grid-cols-2"><div className="h-64 rounded-2xl border border-sky-100/80 bg-white/90 shadow-[0_16px_40px_rgba(37,99,235,0.08)]" /><div className="h-64 rounded-2xl border border-sky-100/80 bg-white/90 shadow-[0_16px_40px_rgba(37,99,235,0.08)]" /></div>
        </div>
      </main>
    );
  }

  if (error || !stats) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-sky-50 via-white to-blue-50 p-6">
        <div className="relative z-10 mx-auto max-w-7xl rounded-3xl border border-sky-100/80 bg-white/90 p-8 text-center shadow-[0_16px_40px_rgba(37,99,235,0.08)]">
          <CircleAlert className="mx-auto mb-3 h-12 w-12 text-rose-600" />
          <p className="font-medium text-red-600">{error || "ไม่สามารถโหลดข้อมูลได้"}</p>
          <button onClick={load} className="mt-4 rounded-lg bg-gradient-to-r from-sky-600 to-blue-600 px-4 py-2 text-sm text-white">ลองใหม่</button>
        </div>
      </main>
    );
  }

  const { active_survey, responses, coverage, top_departments, attention_departments, daily_trend, rating_bands } = stats;
  const avgRating = responses.avg_rating ? Number(responses.avg_rating) : null;
  const overallLabel = resolveLabel(avgRating, rating_bands);
  const maxTrend = Math.max(...daily_trend.map((item) => item.count), 1);
  const totalResponses = Math.max(responses.total, 1);
  const respondentSegments = [
    { label: "นักศึกษา", value: responses.student, color: groupColors.student },
    { label: "บุคลากร", value: responses.staff, color: groupColors.staff },
    { label: "บุคคลทั่วไป", value: responses.public, color: groupColors.public },
  ];

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-sky-50 via-white to-blue-50 p-6 text-slate-900">
      <div className="pointer-events-none absolute -top-32 -left-24 h-80 w-80 rounded-full bg-sky-200/30 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 rounded-full bg-blue-200/20 blur-3xl" />
      <div className="relative z-10 mx-auto max-w-7xl space-y-6">
        <div className="relative overflow-hidden rounded-[28px] border border-white/20 bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-600 p-6 text-white shadow-[0_24px_60px_rgba(37,99,235,0.20)]">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs text-sky-50/90">
                <span className="h-2 w-2 rounded-full bg-emerald-300" />
                {formatSurveyLabel(active_survey)}
              </div>
              <h1 className="mt-3 text-2xl font-bold">แดชบอร์ดภาพรวมสำหรับผู้บริหาร</h1>
            </div>
            <div className="flex flex-col items-end gap-2">
              <button onClick={load} className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/20">
                <RefreshCw className="h-4 w-4" />
                รีเฟรช
              </button>
              {refreshed ? <span className="text-xs text-sky-100/80">อัปเดตล่าสุด: {refreshed.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} น.</span> : null}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-white/15 bg-white/10 p-3 text-center"><div className="text-3xl font-bold">{responses.today.toLocaleString("th-TH")}</div><div className="mt-0.5 text-xs text-sky-100/80">ผู้ตอบวันนี้</div></div>
            <div className="rounded-2xl border border-white/15 bg-white/10 p-3 text-center"><div className="text-3xl font-bold">{responses.total.toLocaleString("th-TH")}</div><div className="mt-0.5 text-xs text-sky-100/80">ผู้ตอบสะสม</div></div>
            <div className="rounded-2xl border border-white/15 bg-white/10 p-3 text-center"><div className="text-3xl font-bold">{avgRating ? avgRating.toFixed(2) : "-"}</div><div className="mt-0.5 text-xs text-sky-100/80">{avgRating ? `ผลการประเมิน: ${overallLabel}` : "ยังไม่มีคะแนนเฉลี่ย"}</div></div>
            <div className="rounded-2xl border border-white/15 bg-white/10 p-3 text-center"><div className="text-3xl font-bold">{coverage.departments_with_responses}</div><div className="mt-0.5 text-xs text-sky-100/80">หน่วยงานที่มีข้อมูล</div></div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard icon={Gauge} label="คะแนนเฉลี่ยรวม" value={avgRating ? avgRating.toFixed(2) : "-"} iconClass="from-sky-500 to-cyan-500" />
          <KpiCard icon={MessageSquareText} label="ผลการประเมิน" value={avgRating !== null ? overallLabel : "ยังไม่มีข้อมูล"} iconClass="from-blue-500 to-indigo-500" />
          <KpiCard icon={Building2} label="หน่วยงานที่มีข้อมูล" value={String(coverage.departments_with_responses)} iconClass="from-emerald-500 to-teal-500" />
          <KpiCard icon={ShieldAlert} label="หน่วยงานยังไม่มีข้อมูล" value={String(coverage.departments_without_responses)} iconClass="from-amber-500 to-orange-500" />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <section className="rounded-2xl border border-sky-100/80 bg-white/90 p-5 shadow-[0_16px_40px_rgba(37,99,235,0.08)]">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-[0_10px_22px_rgba(37,99,235,0.18)]">
                <LineChart className="h-5 w-5" />
              </div>
              <h2 className="font-bold text-slate-900">แนวโน้มจำนวนผู้ตอบ 7 วันล่าสุด</h2>
            </div>
            <div className="mt-5 flex h-72 items-end gap-3 rounded-2xl border border-sky-100/80 bg-gradient-to-b from-sky-50/70 to-white px-4 pb-4 pt-6">
              {daily_trend.map((item, index) => (
                <div key={item.day} className="flex flex-1 flex-col items-center">
                  <div className="mb-2 text-xs font-semibold text-slate-700">{item.count.toLocaleString("th-TH")}</div>
                  <div className="flex h-52 w-full items-end justify-center">
                    <div className={`w-full max-w-10 rounded-t-xl bg-gradient-to-t ${index === daily_trend.length - 1 ? "from-sky-600 to-blue-500" : "from-sky-400 to-sky-300"}`} style={{ height: `${Math.max(16, (item.count / maxTrend) * 160)}px` }} />
                  </div>
                  <div className="mt-2 text-xs text-slate-500">{formatDayLabel(item.day)}</div>
                </div>
              ))}
            </div>
          </section>

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

        <div className="grid gap-4 md:grid-cols-2">
          <section className="rounded-2xl border border-sky-100/80 bg-white/90 p-5 shadow-[0_16px_40px_rgba(37,99,235,0.08)]">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-[0_10px_22px_rgba(245,158,11,0.22)]">
                  <Trophy className="h-5 w-5" />
                </div>
                <h2 className="font-bold text-slate-900">หน่วยงานคะแนนเด่น 5 อันดับ</h2>
              </div>
              <Link href="/exec/ranking" className="text-sm font-medium text-sky-700 hover:text-blue-700">ดูทั้งหมด</Link>
            </div>
            <div className="space-y-3">
              {top_departments.length === 0 ? <div className="rounded-2xl border border-sky-100 bg-sky-50/50 px-4 py-8 text-center text-sm text-slate-400">ยังไม่มีข้อมูลจัดอันดับหน่วยงาน</div> : top_departments.map((department, index) => {
                const avg = department.avg_rating ? Number(department.avg_rating) : null;
                const band = resolveBandStyle(avg, rating_bands);
                const width = avg !== null ? (avg / 5) * 100 : 0;
                return (
                  <div key={department.id} className="rounded-2xl border border-sky-100 bg-gradient-to-r from-white to-sky-50/60 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-100 text-xs font-semibold text-sky-700">{index + 1}</span>
                          <div className="truncate text-sm font-semibold text-slate-900">{department.name}</div>
                        </div>
                      </div>
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${band.bgClass}`}>{avg !== null ? `${resolveLabel(avg, rating_bands)} (${avg.toFixed(2)})` : "ยังไม่มีข้อมูล"}</span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-sky-100"><div className="h-2 rounded-full bg-gradient-to-r from-sky-500 to-blue-600" style={{ width: `${width}%` }} /></div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-sky-100/80 bg-white/90 p-5 shadow-[0_16px_40px_rgba(37,99,235,0.08)]">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-orange-500 text-white shadow-[0_10px_22px_rgba(244,63,94,0.18)]">
                <Building2 className="h-5 w-5" />
              </div>
              <h2 className="font-bold text-slate-900">หน่วยงานที่ยังไม่มีข้อมูล</h2>
            </div>
            <div className="mt-4 space-y-3">
              {attention_departments.filter((department) => department.issue_code === "no_data").length === 0 ? <div className="rounded-2xl border border-sky-100 bg-sky-50/50 px-4 py-8 text-center text-sm text-slate-400">ทุกหน่วยงานมีข้อมูลแล้ว</div> : attention_departments.filter((department) => department.issue_code === "no_data").map((department) => {
                const issue = getIssueMeta(department.issue_code, coverage.low_response_threshold);
                const avg = department.avg_rating ? Number(department.avg_rating) : null;
                return (
                  <div key={department.id} className="rounded-2xl border border-sky-100 bg-gradient-to-r from-white to-sky-50/60 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-900">{department.name}</div>
                        <div className="mt-1 text-xs text-slate-500">{issue.desc}</div>
                      </div>
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${issue.badge}`}>{issue.label}</span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                      <div className="rounded-xl border border-sky-100 bg-white px-3 py-2"><div className="text-xs text-slate-500">จำนวนผู้ตอบ</div><div className="mt-1 font-semibold text-slate-900">{department.total_responses.toLocaleString("th-TH")}</div></div>
                      <div className="rounded-xl border border-sky-100 bg-white px-3 py-2"><div className="text-xs text-slate-500">คะแนนเฉลี่ย</div><div className="mt-1 font-semibold text-slate-900">{avg !== null ? avg.toFixed(2) : "-"}</div></div>
                      <div className="rounded-xl border border-sky-100 bg-white px-3 py-2"><div className="text-xs text-slate-500">ระดับผลประเมิน</div><div className="mt-1 font-semibold text-slate-900">{avg !== null ? resolveLabel(avg, rating_bands) : "ยังไม่มีข้อมูล"}</div></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

      </div>
    </main>
  );
}
