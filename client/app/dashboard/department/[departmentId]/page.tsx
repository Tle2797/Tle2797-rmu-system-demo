"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import {
  BadgeCheck,
  BarChart3,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  ClipboardList,
  GraduationCap,
  MessageSquare,
  RefreshCw,
  Users,
  UsersRound,
  UserRound,
} from "lucide-react";
import { apiGet } from "@/lib/api";

type KPI = {
  total: number;
  student: number;
  staff: number;
  public: number;
};

type RatingRow = {
  question_id: number;
  question_text: string;
  n: number;
  avg: number | string;
  sd: number | string | null;
  r1: number;
  r2: number;
  r3: number;
  r4: number;
  r5: number;
};

type RatingBand = {
  id: number;
  min_value: number | string;
  max_value: number | string;
  label_th: string;
  sort_order: number;
};

type SummaryResponse = {
  survey: { id: number; year_be: number; title: string };
  rating_bands: RatingBand[];
  kpi: KPI;
  ratings: RatingRow[];
};

type DepartmentResponse = {
  id: number;
  name: string;
};

type CommentItem = {
  answer_id: number;
  question_id: number;
  question_text: string;
  respondent_group: "student" | "staff" | "public";
  comment: string;
  submitted_at: string;
};

type CommentsResponse = {
  total: number;
  limit: number;
  offset: number;
  items: CommentItem[];
};

type IconType = ComponentType<{ className?: string }>;

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  return fallback;
}

const toNum = (value: unknown): number => {
  if (value === null || value === undefined) return 0;
  const parsed = typeof value === "string" ? Number(value) : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toNumLoose = (value: unknown): number => {
  if (value === null || value === undefined) return NaN;
  const parsed = Number(String(value).trim().replace(",", "."));
  return Number.isFinite(parsed) ? parsed : NaN;
};

function formatThaiDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function resolveOverallLabel(avg: number | null, bands: RatingBand[]) {
  if (!avg || !Number.isFinite(avg) || bands.length === 0) return "ยังไม่มีข้อมูล";
  const clamped = Math.max(0, Math.min(5, avg));
  const v = Number(clamped.toFixed(1));

  const ordered = [...bands].sort((a, b) => Number(a.sort_order) - Number(b.sort_order));
  const found = ordered.find((band) => {
    const min = toNumLoose(band.min_value);
    const max = toNumLoose(band.max_value);
    return Number.isFinite(min) && Number.isFinite(max) && v >= min && v <= max;
  });

  if (found) return found.label_th;

  const byMax = [...ordered].sort((a, b) => toNumLoose(a.max_value) - toNumLoose(b.max_value));
  return byMax.find((band) => v <= toNumLoose(band.max_value))?.label_th ?? "ไม่ทราบเกณฑ์";
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  cardClass = "border-slate-200/80 bg-white/95",
  iconClass = "from-sky-500 to-blue-600",
  valueClass = "text-2xl",
}: {
  icon: IconType;
  label: string;
  value: string | number;
  sub?: string;
  cardClass?: string;
  iconClass?: string;
  valueClass?: string;
}) {
  return (
    <div
      className={`rounded-[24px] border p-4 shadow-[0_14px_30px_rgba(37,99,235,0.07)] transition-transform duration-200 hover:-translate-y-0.5 ${cardClass}`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${iconClass} text-white shadow-[0_10px_22px_rgba(15,23,42,0.12)] ring-1 ring-white/30`}
          aria-hidden="true"
        >
          <Icon className="h-5 w-5" />
        </div>

        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            {label}
          </div>
          <div className={`mt-1 break-words font-black tracking-tight text-slate-900 ${valueClass}`}>
            {value}
          </div>
          {sub ? <div className="mt-1 text-xs text-slate-500">{sub}</div> : null}
        </div>
      </div>
    </div>
  );
}

const DEPT_THEME_ICONS = {
  primary: "from-sky-500 to-cyan-500",
  success: "from-emerald-500 to-teal-500",
  neutral: "from-slate-500 to-slate-600",
} as const;

function SectionCard({
  title,
  icon: Icon,
  children,
  right,
}: {
  title: string;
  icon: IconType;
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[28px] border border-white/70 bg-white/90 shadow-[0_18px_45px_rgba(37,99,235,0.08)] backdrop-blur-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-[0_12px_24px_rgba(37,99,235,0.18)]">
            <Icon className="h-5 w-5" />
          </div>
          <h2 className="text-lg font-black text-slate-900">{title}</h2>
        </div>

        {right ? <div className="text-sm font-semibold text-slate-500">{right}</div> : null}
      </div>
      <div className="px-5 py-5 sm:px-6">{children}</div>
    </section>
  );
}

function LoadingSkeleton() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-sky-50 via-white to-blue-50 p-4 sm:p-6 lg:p-8">
      <div className="pointer-events-none absolute -left-24 top-[-5rem] h-72 w-72 rounded-full bg-sky-200/30 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 rounded-full bg-blue-200/20 blur-3xl" />

      <div className="relative z-10 mx-auto flex max-w-6xl flex-col gap-5 animate-pulse">
        <div className="h-36 rounded-[30px] border border-white/70 bg-white/90 shadow-[0_18px_45px_rgba(37,99,235,0.08)]" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[...Array(4)].map((_, index) => (
            <div
              key={`top-skeleton-${index}`}
              className="h-[108px] rounded-[24px] border border-white/70 bg-white/90 shadow-[0_14px_30px_rgba(37,99,235,0.07)]"
            />
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {[...Array(3)].map((_, index) => (
            <div
              key={`bottom-skeleton-${index}`}
              className="h-[108px] rounded-[24px] border border-white/70 bg-white/90 shadow-[0_14px_30px_rgba(37,99,235,0.07)]"
            />
          ))}
        </div>
        <div className="h-[420px] rounded-[28px] border border-white/70 bg-white/90 shadow-[0_18px_45px_rgba(37,99,235,0.08)]" />
        <div className="h-[260px] rounded-[28px] border border-white/70 bg-white/90 shadow-[0_18px_45px_rgba(37,99,235,0.08)]" />
      </div>
    </main>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-sky-50 via-white to-blue-50 p-4 sm:p-6 lg:p-8">
      <div className="pointer-events-none absolute -left-24 top-[-5rem] h-72 w-72 rounded-full bg-sky-200/30 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 rounded-full bg-blue-200/20 blur-3xl" />

      <div className="relative z-10 mx-auto flex max-w-3xl items-center justify-center">
        <section className="w-full rounded-[28px] border border-white/70 bg-white/90 p-8 text-center shadow-[0_18px_45px_rgba(37,99,235,0.08)] backdrop-blur-sm">
          <CircleAlert className="mx-auto h-12 w-12 text-rose-500" />
          <h1 className="mt-4 text-2xl font-black text-slate-900">แดชบอร์ดหน่วยงาน</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">ไม่สามารถโหลดข้อมูลได้: {message}</p>
          <p className="mt-2 text-sm text-slate-500">
            โปรดตรวจสอบว่า backend ทำงานอยู่ และมีแบบสอบถามที่เปิดใช้งาน
          </p>

          <button
            type="button"
            onClick={onRetry}
            className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-sky-600 to-blue-600 px-5 py-3 font-semibold text-white shadow-[0_16px_35px_rgba(37,99,235,0.22)] transition hover:from-sky-500 hover:to-blue-500"
          >
            <RefreshCw className="h-4 w-4" />
            ลองใหม่
          </button>
        </section>
      </div>
    </main>
  );
}

export default function DepartmentDashboardPage() {
  const params = useParams<{ departmentId: string }>();
  const searchParams = useSearchParams();

  const departmentParam = Array.isArray(params.departmentId)
    ? params.departmentId[0]
    : params.departmentId;
  const deptId = Number(departmentParam);

  const limit = Math.max(1, Math.min(Number(searchParams.get("limit")) || 3, 50));
  const offset = Math.max(Number(searchParams.get("offset")) || 0, 0);

  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [comments, setComments] = useState<CommentsResponse | null>(null);
  const [dept, setDept] = useState<DepartmentResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;

    const loadData = async () => {
      if (!Number.isFinite(deptId)) {
        setErrorMsg("รหัสหน่วยงานไม่ถูกต้อง");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setErrorMsg("");
        setSummary(null);
        setComments(null);
        setDept(null);

        const [summaryRes, commentsRes] = await Promise.all([
          apiGet<SummaryResponse>(`/api/dashboard/department/${deptId}/summary`),
          apiGet<CommentsResponse>(
            `/api/dashboard/department/${deptId}/comments?limit=${limit}&offset=${offset}`,
          ),
        ]);

        if (!alive) return;

        setSummary(summaryRes);
        setComments(commentsRes);

        try {
          const rawDept = await apiGet<{ department: DepartmentResponse } | DepartmentResponse>(
            `/api/departments/${deptId}`,
          );

          if (!alive) return;

          if (rawDept && "department" in rawDept && rawDept.department?.name) {
            setDept(rawDept.department);
          } else if (rawDept && "name" in rawDept && rawDept.name) {
            setDept(rawDept as DepartmentResponse);
          }
        } catch {
          // ชื่อหน่วยงานเป็นข้อมูลเสริม ถ้าโหลดไม่ได้ยังแสดงแดชบอร์ดได้
        }
      } catch (error: unknown) {
        if (!alive) return;
        setErrorMsg(getErrorMessage(error, "ไม่สามารถโหลดข้อมูลได้"));
      } finally {
        if (alive) setLoading(false);
      }
    };

    void loadData();

    return () => {
      alive = false;
    };
  }, [deptId, limit, offset, reloadKey]);

  if (!Number.isFinite(deptId)) {
    return (
      <ErrorState
        message="รหัสหน่วยงานไม่ถูกต้อง"
        onRetry={() => setReloadKey((prev) => prev + 1)}
      />
    );
  }

  if (loading && !summary && !comments) {
    return <LoadingSkeleton />;
  }

  if (errorMsg) {
    return (
      <ErrorState
        message={errorMsg}
        onRetry={() => setReloadKey((prev) => prev + 1)}
      />
    );
  }

  const kpi = summary?.kpi ?? { total: 0, student: 0, staff: 0, public: 0 };
  const ratings = summary?.ratings ?? [];
  const cm = comments ?? { total: 0, limit, offset, items: [] };

  const totalN = ratings.reduce((acc, row) => acc + toNum(row.n), 0);
  const overallAvg =
    totalN > 0
      ? ratings.reduce((acc, row) => acc + toNum(row.avg) * toNum(row.n), 0) / totalN
      : null;
  const bands = summary?.rating_bands ?? [];
  const overallLabel = resolveOverallLabel(overallAvg, bands);

  const prevOffset = Math.max(offset - limit, 0);
  const nextOffset = offset + limit;
  const hasPrev = offset > 0;
  const hasNext = nextOffset < cm.total;

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-sky-50 via-white to-blue-50 p-4 text-slate-900 sm:p-6 lg:p-8">
      <div className="pointer-events-none absolute -left-24 top-[-5rem] h-72 w-72 rounded-full bg-sky-200/30 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 rounded-full bg-blue-200/20 blur-3xl" />

      <div className="relative z-10 mx-auto flex max-w-6xl flex-col gap-5">
        <section className="relative overflow-hidden rounded-[28px] border border-white/20 bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-600 p-6 text-white shadow-[0_24px_60px_rgba(37,99,235,0.20)]">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-16 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-sky-200/15 blur-3xl" />

          <div className="relative z-10 flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-4">
              <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-white/15 text-white ring-1 ring-white/20 backdrop-blur-md">
                <BarChart3 className="h-7 w-7" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h1 className="mt-1 text-2xl font-bold text-white">แดชบอร์ดหน่วยงาน</h1>
                <p className="mt-1 text-sm text-sky-100/90">
                  หน่วยงาน: {dept?.name || `หน่วยงาน #${deptId}`}
                </p>
                <h1 className="hidden">
                แดชบอร์ดหน่วยงาน : {dept?.name || `หน่วยงาน #${deptId}`}
              </h1>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-sky-100/90">
                <span className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-sky-100 backdrop-blur-md">
                  {summary?.survey.title ?? "แบบสอบถามที่เปิดใช้งาน"}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 backdrop-blur-md">
                  ปี พ.ศ. {summary?.survey.year_be ?? "-"}
                </span>
              </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard
            icon={BarChart3}
            label="คะแนนเฉลี่ยรวม"
            value={overallAvg !== null ? overallAvg.toFixed(2) : "-"}
            cardClass="border-slate-200/80 bg-white/95 shadow-[0_16px_40px_rgba(37,99,235,0.08)]"
            iconClass={DEPT_THEME_ICONS.primary}
            valueClass="text-3xl tabular-nums"
          />
          <StatCard
            icon={BadgeCheck}
            label="ผลการประเมิน"
            value={overallLabel}
            cardClass="border-slate-200/80 bg-white/95 shadow-[0_16px_40px_rgba(37,99,235,0.08)]"
            iconClass={DEPT_THEME_ICONS.success}
            valueClass="text-lg"
          />
          <StatCard
            icon={Users}
            label="จำนวนผู้ประเมิน"
            value={kpi.total.toLocaleString("th-TH")}
            cardClass="border-slate-200/80 bg-white/95"
            iconClass={DEPT_THEME_ICONS.primary}
            valueClass="text-3xl tabular-nums"
          />
        </section>

        <section className="grid gap-3 sm:grid-cols-3">
          <StatCard
            icon={GraduationCap}
            label="นักศึกษา"
            value={kpi.student.toLocaleString("th-TH")}
            cardClass="border-slate-200/80 bg-white/95"
            iconClass={DEPT_THEME_ICONS.primary}
            valueClass="text-3xl tabular-nums"
          />
          <StatCard
            icon={UserRound}
            label="บุคลากร"
            value={kpi.staff.toLocaleString("th-TH")}
            cardClass="border-slate-200/80 bg-white/95"
            iconClass={DEPT_THEME_ICONS.success}
            valueClass="text-3xl tabular-nums"
          />
          <StatCard
            icon={UsersRound}
            label="บุคคลทั่วไป"
            value={kpi.public.toLocaleString("th-TH")}
            cardClass="border-slate-200/80 bg-white/95"
            iconClass={DEPT_THEME_ICONS.neutral}
            valueClass="text-3xl tabular-nums"
          />
        </section>

        <SectionCard
          title="สรุปคะแนนรายคำถาม"
          icon={ClipboardList}
          right={
            ratings.length > 0 ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-sky-100 bg-sky-50 px-3 py-1.5 text-sm font-semibold text-sky-700">
                <ClipboardList className="h-4 w-4" />
                ทั้งหมด {ratings.length.toLocaleString("th-TH")} รายการ
              </span>
            ) : undefined
          }
        >
          {ratings.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-sky-200 bg-sky-50/40 p-8 text-center text-slate-500">
              ยังไม่มีข้อมูลคะแนนสำหรับหน่วยงานนี้
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[920px] w-full border-separate border-spacing-0 text-sm">
                <thead>
                  <tr className="text-left text-slate-600">
                    <th className="w-16 rounded-tl-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-semibold">
                      ข้อ
                    </th>
                    <th className="border border-l-0 border-slate-200 bg-slate-50 px-4 py-3 font-semibold">
                      คำถาม
                    </th>
                    <th className="w-28 border border-l-0 border-slate-200 bg-slate-50 px-4 py-3 text-center font-semibold">
                      ค่าเฉลี่ย
                    </th>
                    <th className="w-40 rounded-tr-2xl border border-l-0 border-slate-200 bg-slate-50 px-4 py-3 text-center font-semibold whitespace-nowrap">
                      ส่วนเบี่ยงเบนมาตรฐาน
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ratings.map((row, index) => (
                    <tr key={row.question_id} className="group">
                      <td className="border border-t-0 border-slate-200 px-4 py-3 text-center text-slate-700 group-hover:bg-sky-50/40">
                        {index + 1}
                      </td>
                      <td className="border border-l-0 border-t-0 border-slate-200 px-4 py-3 group-hover:bg-sky-50/40">
                        <div className="font-medium leading-6 text-slate-900">
                          {row.question_text}
                        </div>
                      </td>
                      <td className="border border-l-0 border-t-0 border-slate-200 px-4 py-3 text-center tabular-nums text-slate-900 group-hover:bg-sky-50/40">
                        {toNum(row.avg).toFixed(2)}
                      </td>
                      <td className="border border-l-0 border-t-0 border-slate-200 px-4 py-3 text-center tabular-nums whitespace-nowrap text-slate-900 group-hover:bg-sky-50/40">
                        {row.sd === null ? "-" : toNum(row.sd).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="ความคิดเห็น"
          icon={MessageSquare}
          right={
            <span className="inline-flex items-center gap-2 rounded-full border border-sky-100 bg-sky-50 px-3 py-1.5 text-sm font-semibold text-sky-700">
              <MessageSquare className="h-4 w-4" />
              ทั้งหมด {cm.total.toLocaleString("th-TH")} รายการ
            </span>
          }
        >
          {cm.items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-sky-200 bg-sky-50/40 p-8 text-center text-slate-500">
              ยังไม่มีความคิดเห็นสำหรับหน่วยงานนี้
            </div>
          ) : (
            <div className="space-y-3">
              {cm.items.map((item) => (
                <article
                  key={item.answer_id}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-[0_10px_20px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_28px_rgba(15,23,42,0.06)]"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium leading-6 text-slate-900">
                        {item.comment}
                      </div>
                      {item.question_text && item.question_text !== item.comment ? (
                        <div className="mt-1 text-xs leading-5 text-slate-500">
                          คำถาม: {item.question_text}
                        </div>
                      ) : null}
                    </div>
                    <div className="shrink-0 text-sm font-medium text-slate-500">
                      {formatThaiDate(item.submitted_at)}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          {cm.total > cm.items.length ? (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <div className="text-xs text-slate-500">
                แสดง {cm.items.length.toLocaleString("th-TH")} จากทั้งหมด {cm.total.toLocaleString("th-TH")} รายการ
              </div>
              <div className="flex items-center gap-2">
                <Link
                  aria-disabled={!hasPrev}
                  href={`/dashboard/department/${deptId}?limit=${limit}&offset=${prevOffset}`}
                  className={`inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-sm font-medium transition ${
                    hasPrev
                      ? "border-slate-200 bg-white text-slate-700 hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700"
                      : "pointer-events-none border-slate-100 bg-slate-100 text-slate-400"
                  }`}
                >
                  <ChevronLeft className="h-4 w-4" />
                  ก่อนหน้า
                </Link>
                <Link
                  aria-disabled={!hasNext}
                  href={`/dashboard/department/${deptId}?limit=${limit}&offset=${nextOffset}`}
                  className={`inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-sm font-medium transition ${
                    hasNext
                      ? "border-slate-200 bg-white text-slate-700 hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700"
                      : "pointer-events-none border-slate-100 bg-slate-100 text-slate-400"
                  }`}
                >
                  ถัดไป
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          ) : null}
        </SectionCard>
      </div>
    </main>
  );
}
