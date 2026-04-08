"use client";

import { useEffect, useMemo, useState, type ComponentType, type SVGProps } from "react";
import { Award, Building2, CircleAlert, ListOrdered } from "lucide-react";
import { apiGet } from "@/lib/api";

type RatingBand = {
  id: number;
  min_value: number;
  max_value: number;
  label_th: string;
  sort_order: number;
};

type DepartmentRank = {
  department_id: number;
  department_name: string;
  total_responses: number;
  avg_rating: number;
};

type RankingData = {
  rankings: DepartmentRank[];
  university_avg: number;
  rating_bands: RatingBand[];
};

type KpiIcon = ComponentType<SVGProps<SVGSVGElement>>;

const PAGE_SIZE = 10;

const RANKING_THEMES = {
  total: {
    cardClass:
      "border-slate-200/80 bg-white/95 shadow-[0_16px_40px_rgba(37,99,235,0.08)]",
    iconClass: "from-sky-500 to-cyan-500",
  },
  scored: {
    cardClass:
      "border-slate-200/80 bg-white/95 shadow-[0_16px_40px_rgba(37,99,235,0.08)]",
    iconClass: "from-emerald-500 to-teal-500",
  },
  topScore: {
    cardClass:
      "border-slate-200/80 bg-white/95 shadow-[0_16px_40px_rgba(37,99,235,0.08)]",
    iconClass: "from-amber-500 to-orange-500",
  },
} as const;

function KpiCard({
  icon: Icon,
  title,
  value,
  sub,
  cardClass,
  iconClass,
}: {
  icon: KpiIcon;
  title: string;
  value: string;
  sub?: string;
  cardClass: string;
  iconClass: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-3xl border p-5 backdrop-blur-sm transition-transform duration-200 hover:-translate-y-0.5 ${cardClass}`}
    >
      <div className="relative flex items-start gap-4">
        <div
          className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${iconClass} text-white shadow-[0_10px_24px_rgba(15,23,42,0.12)] ring-1 ring-white/35`}
        >
          <Icon className="h-6 w-6" strokeWidth={2.25} />
        </div>
        <div className="min-w-0 pt-0.5">
          <div className="text-sm font-medium text-slate-600">{title}</div>
          <div className="text-2xl font-black leading-tight tracking-tight text-slate-900">
            {value}
          </div>
          {sub ? <div className="mt-0.5 text-xs text-slate-500">{sub}</div> : null}
        </div>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-sky-50 via-white to-blue-50 p-6">
      <div className="pointer-events-none absolute -left-24 -top-32 h-80 w-80 rounded-full bg-sky-200/30 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 rounded-full bg-blue-200/20 blur-3xl" />
      <div className="relative z-10 mx-auto max-w-7xl space-y-4 animate-pulse">
        <div className="h-44 rounded-[28px] border border-sky-100/80 bg-white/90 shadow-[0_16px_40px_rgba(37,99,235,0.08)]" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[...Array(3)].map((_, index) => (
            <div
              key={index}
              className="h-28 rounded-3xl border border-sky-100/80 bg-white/90 shadow-[0_16px_40px_rgba(37,99,235,0.08)]"
            />
          ))}
        </div>
        <div className="h-80 rounded-3xl border border-sky-100/80 bg-white/90 shadow-[0_16px_40px_rgba(37,99,235,0.08)]" />
      </div>
    </main>
  );
}

export default function ExecRankingPage() {
  const [data, setData] = useState<RankingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const result = await apiGet<RankingData>("/api/exec/ranking");
      setData(result);
      setCurrentPage(1);
    } catch (errorValue: unknown) {
      setError(errorValue instanceof Error ? errorValue.message : "ไม่สามารถโหลดข้อมูลจัดอันดับได้");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const rankingSummary = useMemo(() => {
    const items = data?.rankings ?? [];
    const scoredItems = items.filter((item) => item.avg_rating > 0);
    const topScore = scoredItems.length > 0 ? Math.max(...scoredItems.map((item) => item.avg_rating)) : 0;

    return {
      total: items.length,
      scored: scoredItems.length,
      topScore,
    };
  }, [data]);

  const paginatedRankings = useMemo(() => {
    const items = data?.rankings ?? [];
    const start = (currentPage - 1) * PAGE_SIZE;
    return items.slice(start, start + PAGE_SIZE);
  }, [currentPage, data]);

  if (loading) return <LoadingSkeleton />;

  if (error || !data) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-sky-50 via-white to-blue-50 p-6">
        <div className="pointer-events-none absolute -left-24 -top-32 h-80 w-80 rounded-full bg-sky-200/30 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 rounded-full bg-blue-200/20 blur-3xl" />
        <div className="relative z-10 mx-auto max-w-7xl rounded-3xl border border-sky-100/80 bg-white/90 p-8 text-center shadow-[0_16px_40px_rgba(37,99,235,0.08)]">
          <CircleAlert className="mx-auto mb-3 h-12 w-12 text-rose-600" />
          <p className="font-medium text-red-600">{error || "ไม่พบข้อมูล"}</p>
          <button
            onClick={load}
            className="mt-4 rounded-lg bg-gradient-to-r from-sky-600 to-blue-600 px-4 py-2 text-sm text-white"
          >
            ลองใหม่
          </button>
        </div>
      </main>
    );
  }

  const { rankings, rating_bands } = data;
  const totalPages = Math.max(1, Math.ceil(rankings.length / PAGE_SIZE));

  const getBand = (score: number) => {
    if (score === 0) {
      return { label: "ไม่มีข้อมูล", colorClass: "border-slate-200 bg-slate-100 text-slate-500" };
    }

    const sorted = [...rating_bands].sort((a, b) => a.sort_order - b.sort_order);
    const maxOrder = sorted[sorted.length - 1]?.sort_order || 1;
    const band = sorted.find((item) => score >= item.min_value && score <= item.max_value);

    if (!band) {
      return { label: "ไม่ทราบเกณฑ์", colorClass: "border-slate-200 bg-slate-100 text-slate-500" };
    }

    const pct = band.sort_order / maxOrder;
    if (pct >= 0.75) {
      return { label: band.label_th, colorClass: "border-emerald-200 bg-emerald-50 text-emerald-700" };
    }
    if (pct >= 0.5) {
      return { label: band.label_th, colorClass: "border-blue-200 bg-blue-50 text-blue-700" };
    }
    if (pct >= 0.25) {
      return { label: band.label_th, colorClass: "border-yellow-200 bg-yellow-50 text-yellow-700" };
    }
    return { label: band.label_th, colorClass: "border-red-200 bg-red-50 text-red-700" };
  };

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
                <ListOrdered className="h-7 w-7" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h1 className="mt-1 text-2xl font-bold text-white">จัดอันดับหน่วยงาน</h1>
                <p className="mt-1 text-sm text-sky-100/90">สรุปคะแนนเฉลี่ยและผลประเมินของแต่ละหน่วยงาน</p>
                <div className="mt-3 inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-sm text-sky-100 backdrop-blur-md">
                  ข้อมูลเรียงตามลำดับคะแนนของหน่วยงาน
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <KpiCard
            icon={Building2}
            title="หน่วยงานทั้งหมด"
            value={rankingSummary.total.toLocaleString("th-TH")}
            cardClass={RANKING_THEMES.total.cardClass}
            iconClass={RANKING_THEMES.total.iconClass}
          />
          <KpiCard
            icon={ListOrdered}
            title="หน่วยงานที่มีคะแนน"
            value={rankingSummary.scored.toLocaleString("th-TH")}
            cardClass={RANKING_THEMES.scored.cardClass}
            iconClass={RANKING_THEMES.scored.iconClass}
          />
          <KpiCard
            icon={Award}
            title="คะแนนเฉลี่ยสูงสุด"
            value={rankingSummary.topScore > 0 ? rankingSummary.topScore.toFixed(2) : "-"}
            cardClass={RANKING_THEMES.topScore.cardClass}
            iconClass={RANKING_THEMES.topScore.iconClass}
          />
        </div>

        <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white/95 shadow-[0_18px_50px_rgba(37,99,235,0.08)]">
          <div className="border-b border-slate-200/80 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-[0_10px_22px_rgba(245,158,11,0.22)]">
                <ListOrdered className="h-5 w-5" />
              </div>
              <h2 className="font-bold text-slate-800">ตารางจัดอันดับหน่วยงาน</h2>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-blue-700/20 bg-gradient-to-r from-sky-600 to-blue-600 text-white">
                <tr>
                  <th className="w-[90px] px-4 py-3 text-center font-semibold">อันดับ</th>
                  <th className="min-w-[320px] px-4 py-3 text-left font-semibold">หน่วยงาน</th>
                  <th className="w-[160px] px-4 py-3 text-center font-semibold">คะแนนเฉลี่ย</th>
                  <th className="w-[190px] px-4 py-3 text-center font-semibold">ผลประเมิน</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rankings.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-slate-500" colSpan={4}>
                      ยังไม่มีข้อมูลการประเมิน
                    </td>
                  </tr>
                ) : (
                  paginatedRankings.map((department, index) => {
                    const band = getBand(department.avg_rating);
                    const rank = (currentPage - 1) * PAGE_SIZE + index + 1;

                    return (
                      <tr key={department.department_id} className="transition hover:bg-slate-50">
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 text-sm font-bold text-sky-700">
                            {rank}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-900">
                          <div className="font-medium">{department.department_name}</div>
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-slate-800">
                          {department.avg_rating > 0 ? department.avg_rating.toFixed(2) : "-"}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {department.avg_rating > 0 ? (
                            <span
                              className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${band.colorClass}`}
                            >
                              {band.label}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {rankings.length > 0 ? (
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
        </div>
      </div>
    </main>
  );
}
