"use client";

import {
  use,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import { apiGet } from "@/lib/api";
import { useReactToPrint } from "react-to-print";
import * as XLSX from "xlsx";
import {
  CircleAlert,
  Download,
  FileSpreadsheet,
  Gauge,
  Printer,
  Trophy,
  Users,
} from "lucide-react";

type RatingBand = {
  id: number;
  min_value: number;
  max_value: number;
  label_th: string;
  sort_order: number;
};

type ReportData = {
  survey?: {
    id: number;
    title: string | null;
    year_be: number | null;
  };
  department: {
    id: number;
    name: string;
  };
  summary: {
    total_responses: number;
    avg_rating: number;
  };
  questions: {
    question_id: number;
    question_text: string;
    avg_rating: number;
    sd: number | null;
  }[];
  rating_bands: RatingBand[];
};

function formatCount(value: number | null | undefined) {
  return Number(value ?? 0).toLocaleString("th-TH");
}

function formatScore(value: number | null | undefined) {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue.toFixed(2) : "-";
}

function formatSurveyTitle(
  survey: ReportData["survey"] | { title: string | null } | null | undefined,
) {
  return survey?.title?.trim() || "ไม่พบชื่อแบบประเมิน";
}

function getBand(score: number | null | undefined, bands: RatingBand[]) {
  if (!score || bands.length === 0) {
    return {
      label: "ไม่มีข้อมูล",
      tone: "border-slate-200 bg-slate-100 text-slate-500",
    };
  }

  const sortedBands = [...bands].sort((a, b) => a.sort_order - b.sort_order);
  const band = sortedBands.find(
    (item) => Number(score) >= item.min_value && Number(score) <= item.max_value,
  );

  if (!band) {
    return {
      label: "ไม่ทราบเกณฑ์",
      tone: "border-slate-200 bg-slate-100 text-slate-500",
    };
  }

  const percent = band.sort_order / (sortedBands.at(-1)?.sort_order || 1);
  if (percent >= 0.75) {
    return { label: band.label_th, tone: "border-emerald-200 bg-emerald-50 text-emerald-700" };
  }
  if (percent >= 0.5) {
    return { label: band.label_th, tone: "border-blue-200 bg-blue-50 text-blue-700" };
  }
  if (percent >= 0.25) {
    return { label: band.label_th, tone: "border-amber-200 bg-amber-50 text-amber-700" };
  }
  return { label: band.label_th, tone: "border-rose-200 bg-rose-50 text-rose-700" };
}

function Kpi({
  icon: Icon,
  title,
  value,
  tone,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="rounded-[24px] border border-slate-200/80 bg-white/95 p-5 shadow-[0_16px_40px_rgba(37,99,235,0.08)]">
      <div className="flex items-start gap-4">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${tone} text-white shadow-[0_10px_24px_rgba(15,23,42,0.12)]`}
        >
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium text-slate-600">{title}</div>
          <div className="text-2xl font-black tracking-tight text-slate-900">{value}</div>
        </div>
      </div>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
  right,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/95 shadow-[0_18px_50px_rgba(37,99,235,0.08)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-white">
            <Icon className="h-5 w-5" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        </div>
        {right}
      </div>
      <div className="px-5 py-5 sm:px-6">{children}</div>
    </section>
  );
}

export default function DashboardReportsPage({
  params,
}: {
  params: Promise<{ departmentId: string }>;
}) {
  const resolvedParams = use(params);
  const departmentId = resolvedParams.departmentId;

  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError("");
        const response = await apiGet<ReportData>(`/api/dashboard/department/${departmentId}/reports`);
        setData(response);
      } catch (unknownError) {
        setError(
          unknownError instanceof Error
            ? unknownError.message
            : "ไม่สามารถโหลดข้อมูลรายงานผลการประเมินได้",
        );
      } finally {
        setLoading(false);
      }
    };

    if (departmentId) {
      void loadData();
    }
  }, [departmentId]);

  const scopeLabel = data?.survey?.year_be
    ? `รายงานปี พ.ศ. ${data.survey.year_be}`
    : "รายงานล่าสุด";
  const surveyTitle = formatSurveyTitle(data?.survey);
  const overallBand = getBand(data?.summary.avg_rating ?? 0, data?.rating_bands ?? []);
  const departmentDisplayName = data?.department?.name ?? `หน่วยงาน #${departmentId}`;

  const printReport = useReactToPrint({
    contentRef: printRef,
    documentTitle: `รายงานผลการประเมิน_${departmentDisplayName}_${data?.survey?.year_be ?? "latest"}`,
  });

  const exportExcel = () => {
    if (!data) return;

    const rows = [
      ["ข้อ", "คำถาม", "คะแนนเฉลี่ย", "ส่วนเบี่ยงเบนมาตรฐาน"],
      ...data.questions.map((item, index) => [
        index + 1,
        item.question_text,
        formatScore(item.avg_rating),
        item.sd === null ? "-" : item.sd.toFixed(2),
      ]),
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Department Reports");
    XLSX.writeFile(
      workbook,
      `รายงานผลการประเมิน_${departmentDisplayName}_${data.survey?.year_be ?? "latest"}.xlsx`,
    );
  };

  if (loading && !data) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-blue-50 p-6">
        <div className="mx-auto max-w-7xl rounded-[28px] border border-sky-100/80 bg-white/90 p-20 text-center text-slate-500 shadow-[0_16px_40px_rgba(37,99,235,0.08)]">
          กำลังเตรียมรายงาน...
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-sky-50 via-white to-blue-50 p-6 text-slate-900">
      <div className="pointer-events-none absolute -left-24 -top-32 h-80 w-80 rounded-full bg-sky-200/30 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 rounded-full bg-blue-200/20 blur-3xl" />

      <div className="relative z-10 mx-auto max-w-7xl space-y-6">
        <section className="relative overflow-hidden rounded-[28px] border border-white/20 bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-600 p-6 text-white shadow-[0_24px_60px_rgba(37,99,235,0.20)]">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-16 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-sky-200/15 blur-3xl" />

          <div className="relative z-10 flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-4">
              <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20 backdrop-blur-md">
                <FileSpreadsheet className="h-7 w-7" />
              </div>
              <div className="min-w-0 max-w-3xl">
                <h1 className="mt-1 text-2xl font-bold text-white sm:text-[2rem]">
                  รายงานผลการประเมินของหน่วยงาน
                </h1>
                <p className="mt-1 text-sm text-sky-100/90">หน่วยงาน: {departmentDisplayName}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-sky-100/90">
                  <span className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-sky-100 backdrop-blur-md">
                    {surveyTitle}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1.5 backdrop-blur-md">
                    {scopeLabel}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => void printReport()}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-slate-900/85 via-blue-950/80 to-sky-900/80 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_16px_34px_rgba(15,23,42,0.22)] transition hover:brightness-110"
              >
                <Printer className="h-4 w-4" />
                ส่งออก PDF
              </button>
              <button
                onClick={exportExcel}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_16px_34px_rgba(16,185,129,0.24)] transition hover:brightness-105"
              >
                <Download className="h-4 w-4" />
                ส่งออก Excel
              </button>
            </div>
          </div>
        </section>

        {error ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700 shadow-sm">
            <div className="flex items-start gap-3">
              <CircleAlert className="mt-0.5 h-5 w-5 flex-shrink-0" />
              {error}
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Kpi
            icon={Users}
            title="ผู้ตอบแบบประเมินรวม"
            value={formatCount(data?.summary.total_responses)}
            tone="from-sky-500 to-cyan-500"
          />
          <Kpi
            icon={Gauge}
            title="คะแนนเฉลี่ยภาพรวม"
            value={formatScore(data?.summary.avg_rating)}
            tone="from-blue-500 to-indigo-500"
          />
          <Kpi
            icon={Trophy}
            title="ผลการประเมิน"
            value={overallBand.label}
            tone="from-emerald-500 to-teal-500"
          />
        </div>

        {data ? (
          <Section
            icon={FileSpreadsheet}
            title="แบบฟอร์มรายงาน"
            right={
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                พร้อมพิมพ์และส่งออก
              </span>
            }
          >
            <div
              ref={printRef}
              className="rounded-[26px] border border-slate-200 bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.05)] sm:p-8"
            >
              <div className="border-b border-slate-200 pb-6 text-center">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">
                  Department Report
                </div>
                <h2 className="mt-2 text-2xl font-black text-slate-900">
                  รายงานสรุปผลการประเมินความพึงพอใจ
                </h2>
                <p className="mt-2 text-sm font-semibold text-slate-800">{departmentDisplayName}</p>
                <p className="mt-2 text-sm text-slate-600">{surveyTitle}</p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm">
                  <span className="rounded-full border border-sky-200 bg-sky-50 px-4 py-1.5 font-semibold text-sky-800">
                    {scopeLabel}
                  </span>
                  <span className="rounded-full border border-slate-200 bg-white px-4 py-1.5 font-medium text-slate-500">
                    รายงานเฉพาะข้อมูลของหน่วยงาน
                  </span>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-center">
                  <div className="text-sm text-slate-500">ผู้ตอบแบบประเมินรวม</div>
                  <div className="mt-2 text-3xl font-black text-sky-700">
                    {formatCount(data.summary.total_responses)}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-center">
                  <div className="text-sm text-slate-500">คะแนนเฉลี่ยภาพรวม</div>
                  <div className="mt-2 text-3xl font-black text-emerald-600">
                    {formatScore(data.summary.avg_rating)}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-center">
                  <div className="text-sm text-slate-500">ผลการประเมินภาพรวม</div>
                  <div className="mt-2 text-xl font-bold text-slate-900">{overallBand.label}</div>
                </div>
              </div>

              <div className="mt-8 overflow-hidden rounded-[22px] border border-slate-200">
                <table className="min-w-full text-sm">
                  <thead className="border-b border-blue-700/20 bg-gradient-to-r from-sky-600 to-blue-600 text-white">
                    <tr>
                      <th className="w-20 px-4 py-3 text-center font-semibold text-white">ข้อ</th>
                      <th className="px-4 py-3 text-left font-semibold text-white">คำถาม</th>
                      <th className="w-40 px-4 py-3 text-center font-semibold text-white">คะแนนเฉลี่ย</th>
                      <th className="w-48 px-4 py-3 text-center font-semibold text-white">
                        ส่วนเบี่ยงเบนมาตรฐาน
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.questions.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-10 text-center text-slate-400">
                          ยังไม่มีข้อมูลการประเมินในรายงานนี้
                        </td>
                      </tr>
                    ) : (
                      data.questions.map((question, index) => (
                        <tr key={question.question_id}>
                          <td className="px-4 py-3 text-center text-slate-500">{index + 1}</td>
                          <td className="px-4 py-3 font-medium text-slate-900">
                            {question.question_text}
                          </td>
                          <td className="px-4 py-3 text-center font-bold text-slate-900">
                            {formatScore(question.avg_rating)}
                          </td>
                          <td className="px-4 py-3 text-center font-medium text-slate-600">
                            {question.sd === null ? "-" : question.sd.toFixed(2)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 border-t border-slate-200 pt-4 text-right text-xs text-slate-400">
                เอกสารนี้สร้างจากระบบประเมินความพึงพอใจของมหาวิทยาลัยราชภัฏมหาสารคาม
              </div>
            </div>
          </Section>
        ) : null}
      </div>
    </main>
  );
}
