"use client";

import {
  use,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import { apiGet } from "@/lib/api";
import {
  Bar,
  CartesianGrid,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BadgeCheck,
  BarChart3,
  CalendarDays,
  CircleAlert,
  GraduationCap,
  RefreshCw,
  TrendingUp,
  UserRound,
  Users,
  UsersRound,
} from "lucide-react";

type YearRow = {
  year_be: number;
  avg_rating: number | null;
  band_label: string | null;
  respondents_total: number;
  student: number;
  staff: number;
  public: number;
};

type YearlyResponse = {
  department: { id: number; name: string };
  from: number | null;
  to: number | null;
  years_with_data: number;
  respondents_total: number;
  student: number;
  staff: number;
  public: number;
  overall_avg: number | null;
  overall_band: string | null;
  rows: YearRow[];
};

type ChartRow = {
  year_be: number;
  label: string;
  avg_rating: number | null;
  respondents_total: number;
  band_label: string | null;
  has_data: boolean;
};

type IconType = ComponentType<{ className?: string }>;

function getCurrentBEYear() {
  const now = new Date();
  return now.getFullYear() + 543;
}

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

function formatScore(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-";
  return Number(value).toFixed(2);
}

function formatCount(value: number | null | undefined) {
  return Number(value ?? 0).toLocaleString("th-TH");
}

function parseScore(value: number | null | undefined) {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function calculateWeightedAverage(rows: Array<{ avg_rating: number | null; respondents_total: number }>) {
  const weighted = rows.reduce(
    (acc, row) => {
      const score = parseScore(row.avg_rating);
      const weight = Number(row.respondents_total ?? 0);

      if (score === null || weight <= 0) return acc;

      acc.totalScore += score * weight;
      acc.totalWeight += weight;
      return acc;
    },
    { totalScore: 0, totalWeight: 0 },
  );

  if (weighted.totalWeight > 0) {
    return Number((weighted.totalScore / weighted.totalWeight).toFixed(2));
  }

  const scores = rows
    .map((row) => parseScore(row.avg_rating))
    .filter((score): score is number => score !== null);

  if (scores.length === 0) return null;

  return Number((scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(2));
}

const YEARLY_THEME = {
  primary: "from-sky-500 to-cyan-500",
  success: "from-emerald-500 to-teal-500",
  neutral: "from-slate-500 to-slate-600",
  accent: "from-blue-600 to-indigo-600",
} as const;

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  cardClass = "border-slate-200/80 bg-white/95",
  iconClass = YEARLY_THEME.primary,
  valueClass = "text-3xl tabular-nums",
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
          {sub ? <div className="mt-1 text-xs leading-5 text-slate-500">{sub}</div> : null}
        </div>
      </div>
    </div>
  );
}

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
        <div className="h-[500px] rounded-[28px] border border-white/70 bg-white/90 shadow-[0_18px_45px_rgba(37,99,235,0.08)]" />
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
          <h1 className="mt-4 text-2xl font-black text-slate-900">สรุปผลการประเมินรายปี</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            ไม่สามารถโหลดข้อมูลได้: {message}
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

function YearlyChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: ChartRow }>;
}) {
  const row = payload?.[0]?.payload;

  if (!active || !row) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-[0_18px_45px_rgba(15,23,42,0.12)]">
      <div className="text-sm font-bold text-slate-900">พ.ศ. {row.year_be}</div>
      {row.has_data ? (
        <div className="mt-3 space-y-2 text-sm text-slate-600">
          <div className="flex items-center justify-between gap-4">
            <span>คะแนนเฉลี่ย</span>
            <span className="font-bold text-slate-900">{formatScore(row.avg_rating)}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span>ผู้ตอบทั้งหมด</span>
            <span className="font-bold text-slate-900">{formatCount(row.respondents_total)} คน</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span>ผลการประเมิน</span>
            <span className="font-bold text-sky-700">{row.band_label ?? "-"}</span>
          </div>
        </div>
      ) : (
        <div className="mt-2 text-sm text-slate-500">ยังไม่มีข้อมูลการประเมินในปีนี้</div>
      )}
    </div>
  );
}

export default function YearlyDashboardPage({
  params,
}: {
  params: Promise<{ departmentId: string }>;
}) {
  const { departmentId } = use(params);
  const deptId = Number(departmentId);
  const currentBE = getCurrentBEYear();
  const fromYear = currentBE - 4;
  const toYear = currentBE;

  const [data, setData] = useState<YearlyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;

    const run = async () => {
      if (!Number.isFinite(deptId) || deptId <= 0) {
        setError("รหัสหน่วยงานไม่ถูกต้อง");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");

        const res = await apiGet<YearlyResponse>(
          `/api/dashboard/department/${deptId}/yearly?from=${fromYear}&to=${toYear}`,
        );

        if (!alive) return;
        setData(res);
      } catch (err: unknown) {
        if (!alive) return;
        setError(getErrorMessage(err, "โหลดข้อมูลไม่สำเร็จ"));
      } finally {
        if (alive) setLoading(false);
      }
    };

    void run();

    return () => {
      alive = false;
    };
  }, [deptId, fromYear, toYear, reloadKey]);

  const rowsMap = useMemo(() => {
    const map = new Map<number, YearRow>();
    (data?.rows ?? []).forEach((row) => map.set(row.year_be, row));
    return map;
  }, [data]);

  const chartData = useMemo<ChartRow[]>(() => {
    return Array.from({ length: 5 }, (_, index) => {
      const year = fromYear + index;
      const row = rowsMap.get(year);

      return {
        year_be: year,
        label: `${year}`,
        avg_rating: parseScore(row?.avg_rating),
        respondents_total: row?.respondents_total ?? 0,
        band_label: row?.band_label ?? null,
        has_data: Boolean(row),
      };
    });
  }, [fromYear, rowsMap]);

  const hasChartData = chartData.some((item) => item.avg_rating !== null);
  const rangeStart = data?.from ?? fromYear;
  const rangeEnd = data?.to ?? toYear;
  const displayOverallAvg = useMemo(
    () => parseScore(data?.overall_avg) ?? calculateWeightedAverage(data?.rows ?? []),
    [data?.overall_avg, data?.rows],
  );

  if (!Number.isFinite(deptId) || deptId <= 0) {
    return (
      <ErrorState
        message="รหัสหน่วยงานไม่ถูกต้อง"
        onRetry={() => setReloadKey((prev) => prev + 1)}
      />
    );
  }

  if (loading && !data) {
    return <LoadingSkeleton />;
  }

  if (error && !data) {
    return (
      <ErrorState
        message={error}
        onRetry={() => setReloadKey((prev) => prev + 1)}
      />
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-sky-50 via-white to-blue-50 p-4 text-slate-900 sm:p-6 lg:p-8">
      <div className="pointer-events-none absolute -left-24 top-[-5rem] h-72 w-72 rounded-full bg-sky-200/30 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 rounded-full bg-blue-200/20 blur-3xl" />

      <div className="relative z-10 mx-auto flex max-w-6xl flex-col gap-5">
        <section className="relative overflow-hidden rounded-[32px] border border-white/20 bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-600 px-6 py-7 text-white shadow-[0_24px_60px_rgba(37,99,235,0.20)] sm:px-8">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-16 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-sky-200/15 blur-3xl" />

          <div className="relative z-10 flex items-start gap-4 sm:gap-5">
            <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl bg-white/15 text-white ring-1 ring-white/20 backdrop-blur-md">
              <BarChart3 className="h-8 w-8" aria-hidden="true" />
            </div>

            <div className="min-w-0 flex-1">
              <h1 className="mt-1 text-2xl font-bold text-white sm:text-[2rem]">
                สรุปผลการประเมินรายปี
              </h1>
              <p className="mt-1 text-sm text-sky-100/90">
                หน่วยงาน: {data?.department?.name || `หน่วยงาน #${deptId}`}
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-sky-100 backdrop-blur-md sm:text-sm">
                  <CalendarDays className="mr-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  กราฟ 5 ปีล่าสุด
                </span>
                <span className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-sky-100 backdrop-blur-md sm:text-sm">
                  พ.ศ. {rangeStart} - {rangeEnd}
                </span>
              </div>
            </div>
          </div>
        </section>

        {error ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm">
            {error}
          </div>
        ) : null}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={BarChart3}
            label="คะแนนเฉลี่ยรวม"
            value={formatScore(displayOverallAvg)}
            cardClass="border-slate-200/80 bg-white/95 shadow-[0_16px_40px_rgba(37,99,235,0.08)]"
            iconClass={YEARLY_THEME.primary}
          />
          <StatCard
            icon={BadgeCheck}
            label="ผลการประเมิน"
            value={data?.overall_band ?? "ยังไม่มีข้อมูล"}
            cardClass="border-slate-200/80 bg-white/95 shadow-[0_16px_40px_rgba(37,99,235,0.08)]"
            iconClass={YEARLY_THEME.success}
            valueClass="text-lg"
          />
          <StatCard
            icon={CalendarDays}
            label="จำนวนปีที่มีข้อมูล"
            value={`${formatCount(data?.years_with_data)} ปี`}
            cardClass="border-slate-200/80 bg-white/95"
            iconClass={YEARLY_THEME.accent}
            valueClass="text-2xl"
          />
          <StatCard
            icon={Users}
            label="ผู้ตอบทั้งหมด"
            value={`${formatCount(data?.respondents_total)} คน`}
            cardClass="border-slate-200/80 bg-white/95"
            iconClass={YEARLY_THEME.primary}
            valueClass="text-2xl"
          />
        </section>

        <section className="grid gap-3 sm:grid-cols-3">
          <StatCard
            icon={GraduationCap}
            label="นักศึกษา"
            value={`${formatCount(data?.student)} คน`}
            cardClass="border-slate-200/80 bg-white/95"
            iconClass={YEARLY_THEME.primary}
            valueClass="text-2xl"
          />
          <StatCard
            icon={UserRound}
            label="บุคลากร"
            value={`${formatCount(data?.staff)} คน`}
            cardClass="border-slate-200/80 bg-white/95"
            iconClass={YEARLY_THEME.success}
            valueClass="text-2xl"
          />
          <StatCard
            icon={UsersRound}
            label="บุคคลทั่วไป"
            value={`${formatCount(data?.public)} คน`}
            cardClass="border-slate-200/80 bg-white/95"
            iconClass={YEARLY_THEME.neutral}
            valueClass="text-2xl"
          />
        </section>

        <SectionCard
          title={`กราฟคะแนนเฉลี่ย 5 ปีล่าสุด `}
          icon={TrendingUp}
        >
          <div className="rounded-[26px] border border-sky-100/80 bg-gradient-to-b from-[#f5f9ff] via-white to-white p-4 shadow-[0_16px_35px_rgba(37,99,235,0.06)] sm:p-5">
            <div className="mb-4 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
            
            </div>

            {hasChartData ? (
              <div className="h-[340px] sm:h-[380px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    margin={{ top: 30, right: 10, bottom: 10, left: 12 }}
                    barCategoryGap="28%"
                  >
                    <defs>
                      <linearGradient id="yearlyBarFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.98} />
                        <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0.92} />
                      </linearGradient>
                    </defs>

                    <CartesianGrid
                      stroke="#cbd5e1"
                      strokeOpacity={0.9}
                      vertical={false}
                    />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={true}
                      stroke="#cbd5e1"
                      tickMargin={12}
                      tick={{ fill: "#475569", fontSize: 12, fontWeight: 600 }}
                    />
                    <YAxis
                      width={28}
                      axisLine={true}
                      tickLine={false}
                      stroke="#cbd5e1"
                      domain={[0, 5]}
                      ticks={[1, 2, 3, 4, 5]}
                      allowDecimals={false}
                      tick={{ fill: "#64748b", fontSize: 12, fontWeight: 600 }}
                    />
                    <Tooltip
                      content={<YearlyChartTooltip />}
                      cursor={{ fill: "#e0f2fe", fillOpacity: 0.5 }}
                    />
                    <Bar
                      dataKey="avg_rating"
                      fill="url(#yearlyBarFill)"
                      radius={[14, 14, 0, 0]}
                      barSize={44}
                    >
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-[340px] items-center justify-center rounded-[22px] border border-dashed border-sky-200 bg-sky-50/40 text-center text-sm text-slate-500">
                ยังไม่มีข้อมูลคะแนนเฉลี่ยในช่วง 5 ปีล่าสุด
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="สรุปข้อมูลรายปี"
          icon={BadgeCheck}
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {chartData.map((item) => {
              const scoreText = formatScore(item.avg_rating);
              const bandText = item.has_data ? item.band_label ?? "-" : "ไม่มีข้อมูล";
              const cardTone = item.has_data
                ? "border-sky-100/80 bg-gradient-to-b from-white to-sky-50/60"
                : "border-slate-200/80 bg-white/90";

              return (
                <article
                  key={item.year_be}
                  className={`rounded-[24px] border p-4 shadow-[0_12px_28px_rgba(37,99,235,0.06)] transition hover:-translate-y-0.5 ${cardTone}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                        พ.ศ. {item.year_be}
                      </div>
                      <div className="mt-2 text-3xl font-black tracking-tight text-slate-900 tabular-nums">
                        {scoreText}
                      </div>
                    </div>
                    <div
                      className={`flex h-11 w-11 items-center justify-center rounded-2xl text-white shadow-[0_10px_22px_rgba(15,23,42,0.12)] ring-1 ring-white/30 ${
                        item.has_data
                          ? "bg-gradient-to-br from-sky-500 to-blue-600"
                          : "bg-gradient-to-br from-slate-400 to-slate-500"
                      }`}
                      aria-hidden="true"
                    >
                      <BarChart3 className="h-5 w-5" />
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                        item.has_data
                          ? "bg-sky-100 text-sky-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {bandText}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-500 ring-1 ring-slate-200/80">
                      ผู้ตอบ {formatCount(item.respondents_total)} คน
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        </SectionCard>
      </div>
    </main>
  );
}
