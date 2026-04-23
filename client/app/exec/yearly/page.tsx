"use client";

import {
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import { apiGet } from "@/lib/api";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BarChart3,
  Building2,
  CalendarDays,
  CircleAlert,
  BadgeCheck,
  LineChart,
  RefreshCw,
  TrendingUp,
} from "lucide-react";

type RatingBand = {
  id: number;
  min_value: number;
  max_value: number;
  label_th: string;
  sort_order: number;
};

type YearlyOverview = {
  year: number;
  year_th: number;
  avg_rating: number;
};

type DepartmentDetail = {
  department_id: number;
  department_name: string;
  scores: Record<string, number>;
  latest_diff: number;
};

type YearlyStats = {
  years_list: number[];
  yearly_overview: YearlyOverview[];
  departments_detail: DepartmentDetail[];
  rating_bands: RatingBand[];
};

type ChartRow = {
  year_be: number;
  label: string;
  avg_rating: number | null;
  has_data: boolean;
  evaluation_label: string;
  evaluation_bg_class: string;
};

type IconType = ComponentType<{ className?: string }>;

const PAGE_SIZE = 10;

const YEARLY_THEME = {
  primary: "from-sky-500 to-cyan-500",
  success: "from-emerald-500 to-teal-500",
  accent: "from-blue-600 to-indigo-600",
} as const;

function getCurrentBEYear() {
  return new Date().getFullYear() + 543;
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

function parseScore(value: number | null | undefined) {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function formatScore(value: number | null | undefined) {
  const parsed = parseScore(value);
  if (parsed === null) return "-";
  return parsed.toFixed(2);
}

function formatCount(value: number | null | undefined) {
  return Number(value ?? 0).toLocaleString("th-TH");
}

function calculateAverage(values: Array<number | null>) {
  const filtered = values.filter((value): value is number => value !== null);
  if (filtered.length === 0) return null;

  const average = filtered.reduce((sum, value) => sum + value, 0) / filtered.length;
  return Number(average.toFixed(2));
}

function resolveBandMeta(avg: number | null, bands: RatingBand[]) {
  if (!avg || !Number.isFinite(avg) || bands.length === 0) {
    return {
      label: "ยังไม่มีข้อมูล",
      bgClass: "bg-slate-100 text-slate-500 border-slate-200",
      textClass: "text-slate-500",
    };
  }

  const value = Number(Math.max(0, Math.min(5, avg)).toFixed(1));
  const ordered = [...bands].sort((left, right) => left.sort_order - right.sort_order);
  const found = ordered.find((band) => value >= band.min_value && value <= band.max_value);

  if (!found) {
    return {
      label: "ยังไม่มีข้อมูล",
      bgClass: "bg-slate-100 text-slate-500 border-slate-200",
      textClass: "text-slate-500",
    };
  }

  const maxOrder = Math.max(...ordered.map((band) => band.sort_order));
  const minOrder = Math.min(...ordered.map((band) => band.sort_order));
  const pct = (found.sort_order - minOrder) / (maxOrder - minOrder || 1);

  if (pct >= 0.75) {
    return {
      label: found.label_th,
      bgClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
      textClass: "text-emerald-600",
    };
  }

  if (pct >= 0.5) {
    return {
      label: found.label_th,
      bgClass: "bg-blue-50 text-blue-700 border-blue-200",
      textClass: "text-blue-600",
    };
  }

  if (pct >= 0.25) {
    return {
      label: found.label_th,
      bgClass: "bg-yellow-50 text-yellow-700 border-yellow-200",
      textClass: "text-yellow-600",
    };
  }

  return {
    label: found.label_th,
    bgClass: "bg-rose-50 text-rose-700 border-rose-200",
    textClass: "text-rose-600",
  };
}

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

      <div className="relative z-10 mx-auto flex max-w-6xl animate-pulse flex-col gap-5">
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
            <span>ผลการประเมิน</span>
            <span
              className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${row.evaluation_bg_class}`}
            >
              {row.evaluation_label}
            </span>
          </div>
        </div>
      ) : (
        <div className="mt-2 text-sm text-slate-500">ยังไม่มีข้อมูลการประเมินในปีนี้</div>
      )}
    </div>
  );
}

export default function ExecYearlyPage() {
  const currentBE = getCurrentBEYear();
  const fallbackYears = Array.from({ length: 5 }, (_, index) => currentBE - 4 + index);

  const [data, setData] = useState<YearlyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        setLoading(true);
        setError("");

        const res = await apiGet<YearlyStats>("/api/exec/yearly");
        if (!alive) return;

        setData(res);
        setCurrentPage(1);
      } catch (error) {
        if (!alive) return;
        setError(getErrorMessage(error, "โหลดข้อมูลรายปีไม่สำเร็จ"));
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      alive = false;
    };
  }, [reloadKey]);

  const yearLabels = useMemo(
    () => (data?.years_list?.length ? data.years_list : fallbackYears),
    [data?.years_list, fallbackYears],
  );

  const yearlyOverviewMap = useMemo(() => {
    const map = new Map<number, YearlyOverview>();
    (data?.yearly_overview ?? []).forEach((item) => map.set(item.year_th, item));
    return map;
  }, [data?.yearly_overview]);

  const ratingBands = useMemo(() => data?.rating_bands ?? [], [data?.rating_bands]);

  const chartData = useMemo<ChartRow[]>(() => {
    return yearLabels.map((yearBE) => {
      const overview = yearlyOverviewMap.get(yearBE);
      const average = parseScore(overview?.avg_rating);
      const evaluation = resolveBandMeta(average, ratingBands);

      return {
        year_be: yearBE,
        label: `${yearBE}`,
        avg_rating: average,
        has_data: average !== null,
        evaluation_label: evaluation.label,
        evaluation_bg_class: evaluation.bgClass,
      };
    });
  }, [ratingBands, yearLabels, yearlyOverviewMap]);

  const overallAverage = useMemo(
    () => calculateAverage(chartData.map((item) => item.avg_rating)),
    [chartData],
  );
  const overallEvaluation = resolveBandMeta(overallAverage, ratingBands);

  const comparisonRows = useMemo(() => {
    const latestBE = yearLabels[yearLabels.length - 1];

    return [...(data?.departments_detail ?? [])].sort((left, right) => {
      const leftScore = latestBE ? parseScore(left.scores[String(latestBE)]) ?? -1 : -1;
      const rightScore = latestBE ? parseScore(right.scores[String(latestBE)]) ?? -1 : -1;

      if (leftScore !== rightScore) {
        return rightScore - leftScore;
      }

      return left.department_name.localeCompare(right.department_name, "th");
    });
  }, [data?.departments_detail, yearLabels]);

  const totalPages = Math.max(1, Math.ceil(comparisonRows.length / PAGE_SIZE));

  const paginatedComparisonRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return comparisonRows.slice(start, start + PAGE_SIZE);
  }, [comparisonRows, currentPage]);

  const hasChartData = chartData.some((item) => item.avg_rating !== null);
  const totalDepartments = data?.departments_detail.length ?? 0;
  const yearsWithData = chartData.filter((item) => item.has_data).length;
  const latestYear = chartData[chartData.length - 1] ?? null;
  const rangeStart = yearLabels[0] ?? fallbackYears[0];
  const rangeEnd = yearLabels[yearLabels.length - 1] ?? fallbackYears[fallbackYears.length - 1];

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
                ภาพรวมผลการประเมินรายปีของทุกหน่วยงานในมหาวิทยาลัย
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
            value={formatScore(overallAverage)}
            cardClass="border-slate-200/80 bg-white/95 shadow-[0_16px_40px_rgba(37,99,235,0.08)]"
            iconClass={YEARLY_THEME.primary}
          />
          <StatCard
            icon={BadgeCheck}
            label="ผลการประเมิน"
            value={overallEvaluation.label}
            cardClass={`border-slate-200/80 bg-white/95 shadow-[0_16px_40px_rgba(37,99,235,0.08)] ${overallEvaluation.bgClass}`}
            iconClass={YEARLY_THEME.success}
            valueClass="text-xl"
          />
          <StatCard
            icon={CalendarDays}
            label="จำนวนปีที่มีข้อมูล"
            value={`${formatCount(yearsWithData)} ปี`}
            cardClass="border-slate-200/80 bg-white/95 shadow-[0_16px_40px_rgba(37,99,235,0.08)]"
            iconClass={YEARLY_THEME.accent}
            valueClass="text-2xl"
          />
          <StatCard
            icon={LineChart}
            label="คะแนนเฉลี่ยปีล่าสุด"
            value={formatScore(latestYear?.avg_rating)}
            sub={latestYear ? `ผลการประเมิน ${latestYear.evaluation_label}` : undefined}
            cardClass="border-slate-200/80 bg-white/95"
            iconClass={YEARLY_THEME.primary}
            valueClass="text-2xl"
          />
        </section>

        <SectionCard
          title="กราฟคะแนนเฉลี่ย 5 ปีล่าสุด"
          icon={TrendingUp}
        >
          <div className="rounded-[26px] border border-sky-100/80 bg-gradient-to-b from-[#f5f9ff] via-white to-white p-4 shadow-[0_16px_35px_rgba(37,99,235,0.06)] sm:p-5">
            {hasChartData ? (
              <div className="h-[340px] sm:h-[380px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    margin={{ top: 30, right: 10, bottom: 10, left: 12 }}
                    barCategoryGap="28%"
                  >
                    <defs>
                      <linearGradient id="execYearlyBarFill" x1="0" y1="0" x2="0" y2="1">
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
                      axisLine
                      stroke="#cbd5e1"
                      tickMargin={12}
                      tick={{ fill: "#475569", fontSize: 12, fontWeight: 600 }}
                    />
                    <YAxis
                      width={28}
                      axisLine
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
                      fill="url(#execYearlyBarFill)"
                      radius={[14, 14, 0, 0]}
                      barSize={44}
                    />
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
          icon={BarChart3}
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {chartData.map((item) => {
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
                        {formatScore(item.avg_rating)}
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
                      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${
                        item.has_data
                          ? item.evaluation_bg_class
                          : "bg-slate-100 text-slate-500 border-slate-200"
                      }`}
                    >
                      {item.has_data
                        ? `ผลการประเมิน ${item.evaluation_label}`
                        : "ไม่มีข้อมูล"}
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard
          title="ตารางการเปรียบเทียบหน่วยงานรายปี"
          icon={Building2}
          right={`ทั้งหมด ${formatCount(totalDepartments)} หน่วยงาน`}
        >
          <div className="overflow-x-auto">
            <table className="min-w-full whitespace-nowrap text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-600">
                  <th className="px-4 py-3 text-center font-semibold">ลำดับ</th>
                  <th className="px-4 py-3 text-left font-semibold">หน่วยงาน</th>
                  {yearLabels.map((yearBE) => (
                    <th key={yearBE} className="px-4 py-3 text-center font-semibold">
                      พ.ศ. {yearBE}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-center font-semibold">ผลต่างล่าสุด</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={yearLabels.length + 3}
                      className="px-4 py-10 text-center text-slate-400"
                    >
                      ยังไม่มีข้อมูลรายปีของหน่วยงาน
                    </td>
                  </tr>
                ) : (
                  paginatedComparisonRows.map((department, index) => (
                    <tr
                      key={department.department_id}
                      className="border-b border-slate-100 transition last:border-b-0 hover:bg-sky-50/40"
                    >
                      <td className="px-4 py-3 text-center text-slate-500">
                        {(currentPage - 1) * PAGE_SIZE + index + 1}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {department.department_name}
                      </td>
                      {yearLabels.map((yearBE) => {
                        const score = parseScore(department.scores[String(yearBE)]);

                        return (
                          <td
                            key={`${department.department_id}-${yearBE}`}
                            className="px-4 py-3 text-center text-slate-600"
                          >
                            {score === null ? "-" : score.toFixed(2)}
                          </td>
                        );
                      })}
                      <td className="px-4 py-3 text-center font-semibold">
                        {department.latest_diff > 0 ? (
                          <span className="text-emerald-600">
                            +{department.latest_diff.toFixed(2)}
                          </span>
                        ) : department.latest_diff < 0 ? (
                          <span className="text-rose-600">
                            {department.latest_diff.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-slate-400">0.00</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {comparisonRows.length > 0 ? (
            <div className="flex flex-col gap-3 border-t border-slate-200/80 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={currentPage === 1}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  ย้อนกลับ
                </button>
                <div className="rounded-xl bg-sky-50 px-3 py-2 text-sm font-medium text-sky-700">
                  หน้า {currentPage} / {totalPages}
                </div>
                <button
                  type="button"
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  disabled={currentPage === totalPages}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  ถัดไป
                </button>
              </div>
            </div>
          ) : null}
        </SectionCard>
      </div>
    </main>
  );
}
