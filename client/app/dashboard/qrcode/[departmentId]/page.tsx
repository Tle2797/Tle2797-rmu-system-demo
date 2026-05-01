"use client";

import React, { use, useCallback, useEffect, useState, type ComponentType } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  CircleAlert,
  Copy,
  Download,
  Link2,
  RefreshCw,
  QrCode,
} from "lucide-react";
import Swal from "sweetalert2";
import { apiGet, apiPost } from "@/lib/api";
import { getThaiAlertMessage } from "@/lib/alert-message";

type DeptRow = {
  id: number;
  name: string;
  is_active: boolean;
  qrcode_id: number | null;
  image_path: string | null;
  link_target: string | null;
  qr_created_at: string | null;
};

async function downloadQR(imageUrl: string, filename: string) {
  const res = await fetch(imageUrl, {
    method: "GET",
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("ดาวน์โหลด QR Code ไม่สำเร็จ");
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

type IconType = ComponentType<{ className?: string }>;

function StatCard({
  icon: Icon,
  title,
  value,
  sub,
  cardClass = "border-slate-200/80 bg-white/95 shadow-[0_16px_40px_rgba(37,99,235,0.08)]",
  iconClass = "from-sky-500 to-cyan-500",
  valueClass = "text-2xl",
}: {
  icon: IconType;
  title: string;
  value: number | string;
  sub?: string;
  cardClass?: string;
  iconClass?: string;
  valueClass?: string;
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
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0 pt-0.5">
          <div className="text-sm font-medium text-slate-600">{title}</div>
          <div className={`text-2xl font-black leading-tight tracking-tight text-slate-900 ${valueClass}`}>
            {typeof value === "number" ? value.toLocaleString("th-TH") : value}
          </div>
          {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
        </div>
      </div>
    </div>
  );
}

function QrStatusBadge({ hasQr }: { hasQr: boolean }) {
  return hasQr ? (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
      <CheckCircle2 className="h-3.5 w-3.5" />
      พร้อมใช้งาน
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
      <CircleAlert className="h-3.5 w-3.5" />
      ยังไม่มี QR
    </span>
  );
}

async function showSuccessAlert(title: string, text?: string) {
  await Swal.fire({
    icon: "success",
    title,
    text,
    confirmButtonText: "ตกลง",
    confirmButtonColor: "#2563eb",
    showConfirmButton: false,
    timer: 1800,
    timerProgressBar: true,
    customClass: {
      popup: "rounded-3xl border border-emerald-100 shadow-[0_24px_80px_rgba(15,23,42,0.14)]",
      title: "text-xl font-semibold text-slate-900",
      htmlContainer: "text-sm leading-6 text-slate-500",
    },
  });
}

async function showErrorAlert(title: string, text?: string) {
  await Swal.fire({
    icon: "error",
    title,
    text,
    confirmButtonText: "ตกลง",
    confirmButtonColor: "#dc2626",
    customClass: {
      popup: "rounded-3xl border border-rose-100 shadow-[0_24px_80px_rgba(15,23,42,0.14)]",
      title: "text-xl font-semibold text-slate-900",
      htmlContainer: "text-sm leading-6 text-slate-500",
    },
  });
}

async function showConfirmAlert(
  title: string,
  text: string,
  confirmButtonText: string,
) {
  const result = await Swal.fire({
    icon: "warning",
    title,
    text,
    showCancelButton: true,
    confirmButtonText,
    cancelButtonText: "ยกเลิก",
    focusCancel: true,
    confirmButtonColor: "#dc2626",
    cancelButtonColor: "#0369a1",
    customClass: {
      popup: "rounded-3xl border border-rose-100 shadow-[0_24px_80px_rgba(15,23,42,0.14)]",
      title: "text-xl font-semibold text-slate-900",
      htmlContainer: "text-sm leading-6 text-slate-500",
    },
  });

  return result.isConfirmed;
}

export default function DashboardQRCodePage({
  params,
}: {
  params: Promise<{ departmentId: string }>;
}) {
  const { departmentId } = use(params);
  const [dept, setDept] = useState<DeptRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [preview, setPreview] = useState<{
    url: string;
    name: string;
    link: string;
  } | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiGet<{ department: DeptRow }>(
        `/api/departments/${departmentId}`,
      );
      if (res?.department) {
        setDept(res.department);
      } else {
        setDept(null);
      }
    } catch {
      setDept(null);
    } finally {
      setLoading(false);
    }
  }, [departmentId]);

  useEffect(() => {
    if (departmentId) {
      void load();
    }
  }, [departmentId, load]);

  const isQrReady = Boolean(dept?.qrcode_id && dept.image_path);
  const hasLink = Boolean(dept?.link_target?.trim());
  const resetActionLabel = isQrReady ? "รีเซต" : "สร้าง";

  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3080";
  const qrImageSrc = useCallback(
    (imagePath: string) => {
      const path = imagePath.startsWith("/") ? imagePath : `/${imagePath}`;
      return `${baseUrl}${path}?t=${Date.now()}`;
    },
    [baseUrl],
  );

  const handleDownload = async (imagePath: string, filename: string) => {
    try {
      setBusy(true);
      await downloadQR(qrImageSrc(imagePath), filename);
      await showSuccessAlert("ดาวน์โหลด QR Code สำเร็จ");
    } catch (error: unknown) {
      await showErrorAlert(
        "ดาวน์โหลด QR Code ไม่สำเร็จ",
        getThaiAlertMessage(error, "ดาวน์โหลด QR Code ไม่สำเร็จ"),
      );
    } finally {
      setBusy(false);
    }
  };

  const handleResetQr = async () => {
    const confirmed = await showConfirmAlert(
      `${resetActionLabel} QR Code หน่วยงาน`,
      isQrReady
        ? "ระบบจะสร้างไฟล์ QR Code ใหม่ทับของเดิมโดยใช้ลิงก์เดิม ข้อมูลการตอบแบบประเมินจะไม่หาย"
        : "ระบบจะสร้าง QR Code ใหม่สำหรับหน่วยงานนี้โดยใช้ลิงก์เดิม",
      resetActionLabel,
    );

    if (!confirmed) return;

    try {
      setResetting(true);
      const res = await apiPost<{ message: string; department: DeptRow }>(
        `/api/dashboard/qrcode/${departmentId}/reset`,
      );

      if (res?.department) {
        setDept(res.department);
      }
      setPreview(null);
      await showSuccessAlert(
        `${resetActionLabel} QR Code หน่วยงานสำเร็จ`,
        "QR Code ของหน่วยงานถูกสร้างใหม่เรียบร้อยแล้ว",
      );
    } catch (error: unknown) {
      await showErrorAlert(
        `${resetActionLabel} QR Code หน่วยงานไม่สำเร็จ`,
        getThaiAlertMessage(error, `${resetActionLabel} QR Code หน่วยงานไม่สำเร็จ`),
      );
    } finally {
      setResetting(false);
    }
  };

  if (loading) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-sky-50 via-white to-blue-50 p-6">
        <div className="pointer-events-none absolute -left-24 -top-32 h-80 w-80 rounded-full bg-sky-200/30 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 rounded-full bg-blue-200/20 blur-3xl" />

        <div className="relative z-10 mx-auto max-w-7xl space-y-4 animate-pulse">
          <div className="h-44 rounded-[28px] border border-sky-100/80 bg-white/90 shadow-[0_16px_40px_rgba(37,99,235,0.08)]" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {[...Array(3)].map((_, index) => (
              <div
                key={`qr-skeleton-${index}`}
                className="h-28 rounded-3xl border border-sky-100/80 bg-white/90 shadow-[0_16px_40px_rgba(37,99,235,0.08)]"
              />
            ))}
          </div>
          <div className="h-[420px] rounded-3xl border border-sky-100/80 bg-white/90 shadow-[0_16px_40px_rgba(37,99,235,0.08)]" />
        </div>
      </main>
    );
  }

  if (!dept) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-sky-50 via-white to-blue-50 p-4 text-slate-900 sm:p-6 lg:p-8">
        <div className="pointer-events-none absolute -left-24 top-[-5rem] h-72 w-72 rounded-full bg-sky-200/30 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 rounded-full bg-blue-200/20 blur-3xl" />

        <div className="relative z-10 mx-auto flex max-w-3xl items-center justify-center">
          <section className="w-full rounded-[28px] border border-white/70 bg-white/95 p-8 text-center shadow-[0_18px_45px_rgba(37,99,235,0.08)] backdrop-blur-sm">
            <CircleAlert className="mx-auto h-12 w-12 text-rose-500" />
            <h1 className="mt-4 text-2xl font-black text-slate-900">
              ไม่พบข้อมูล QR Code
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              ไม่พบข้อมูล QR Code ของหน่วยงานนี้หรือข้อมูลยังไม่พร้อมใช้งาน
            </p>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-sky-50 via-white to-blue-50 p-4 text-slate-900 sm:p-6 lg:p-8">
      <div className="pointer-events-none absolute -left-24 top-[-5rem] h-72 w-72 rounded-full bg-sky-200/30 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 rounded-full bg-blue-200/20 blur-3xl" />

      <div className="relative z-10 mx-auto flex max-w-7xl flex-col gap-6">
        <section className="relative overflow-hidden rounded-[28px] border border-white/20 bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-600 px-6 py-7 text-white shadow-[0_24px_60px_rgba(37,99,235,0.20)] sm:px-8">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-16 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-sky-200/15 blur-3xl" />

          <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4 sm:gap-5">
              <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl bg-white/15 text-white ring-1 ring-white/20 backdrop-blur-md">
                <QrCode className="h-8 w-8" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h1 className="mt-1 text-2xl font-bold text-white sm:text-[2rem]">
                  คิวอาร์โค้ดหน่วยงาน
                </h1>
                <p className="mt-1 text-sm text-sky-100/90">
                  หน่วยงาน: {dept?.name || `หน่วยงาน #${departmentId}`}
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-sky-100 backdrop-blur-md sm:text-sm">
                    QR Code สำหรับสแกนเข้าแบบประเมิน
                  </span>
                  <QrStatusBadge hasQr={isQrReady} />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <StatCard
            icon={CheckCircle2}
            title="สถานะ QR Code"
            value={isQrReady ? "พร้อมใช้งาน" : "ยังไม่มี QR"}
            iconClass={isQrReady ? "from-emerald-500 to-teal-500" : "from-amber-500 to-orange-500"}
          />
          <StatCard
            icon={Link2}
            title="ลิงก์ต้นทาง"
            value={hasLink ? "มีลิงก์แล้ว" : "ยังไม่มีลิงก์"}
            iconClass={hasLink ? "from-sky-500 to-cyan-500" : "from-slate-500 to-slate-600"}
          />
        </section>

        <section className="overflow-hidden rounded-[28px] border border-white/70 bg-white/95 shadow-[0_18px_45px_rgba(37,99,235,0.08)] backdrop-blur-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-[0_12px_24px_rgba(37,99,235,0.18)]">
                <QrCode className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900">QR Code ของหน่วยงาน</h2>
                <p className="text-sm text-slate-500">สแกนเพื่อเข้าสู่แบบประเมินของหน่วยงานนี้</p>
              </div>
            </div>
            <QrStatusBadge hasQr={isQrReady} />
          </div>

          <div className="grid gap-6 p-5 sm:p-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
            <div className="flex items-center justify-center">
              <button
                type="button"
                className={`group relative flex aspect-square w-full max-w-[380px] items-center justify-center overflow-hidden rounded-[28px] border p-4 transition ${
                  isQrReady
                    ? "border-sky-100 bg-gradient-to-b from-sky-50 to-white shadow-[0_14px_35px_rgba(37,99,235,0.08)] hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(37,99,235,0.12)]"
                    : "cursor-default border-dashed border-sky-200 bg-sky-50/40"
                }`}
                onClick={() => {
                  if (!isQrReady || !dept.image_path) return;
                  setPreview({
                    url: qrImageSrc(dept.image_path),
                    name: dept.name,
                    link: dept.link_target || "",
                  });
                }}
                disabled={!isQrReady}
              >
                {isQrReady && dept.image_path ? (
                  <>
                    <img
                      src={qrImageSrc(dept.image_path)}
                      alt={`QR ${dept.name}`}
                      className="h-full w-full rounded-[22px] object-contain transition-transform duration-300 group-hover:scale-[1.02]"
                    />
                    <div className="absolute inset-4 flex items-center justify-center rounded-[22px] bg-black/0 opacity-0 transition-opacity group-hover:bg-black/30 group-hover:opacity-100">
                      <span className="rounded-full border border-white/20 bg-white/15 px-4 py-2 text-sm font-semibold text-white backdrop-blur-md">
                        คลิกเพื่อดูภาพขนาดเต็ม
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-3 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-sky-500 shadow-[0_12px_24px_rgba(37,99,235,0.08)] ring-1 ring-sky-100">
                      <QrCode className="h-8 w-8" />
                    </div>
                    <div>
                      <p className="text-lg font-black text-slate-900">ยังไม่มี QR Code</p>
                      <p className="mt-1 text-sm leading-6 text-slate-500">
                        เมื่อมี QR Code แล้ว จะแสดงตัวอย่างและให้ดาวน์โหลดได้ทันที
                      </p>
                    </div>
                  </div>
                )}
              </button>
            </div>

            <div className="flex flex-col gap-4">
              <div className="rounded-[26px] border border-sky-100/80 bg-gradient-to-b from-sky-50/80 to-white p-5 shadow-[0_12px_30px_rgba(37,99,235,0.06)]">
                <div className="flex items-center gap-2 text-sm font-semibold text-sky-700">
                  <Link2 className="h-4 w-4" />
                  ลิงก์สำหรับใช้งาน
                </div>

                {hasLink && dept.link_target ? (
                  <div className="mt-4">
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      ลิงก์ตรงสำหรับแชร์
                    </label>
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <input
                        type="text"
                        readOnly
                        value={dept.link_target}
                        className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm outline-none"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(dept.link_target || "");
                            await showSuccessAlert("คัดลอกลิงก์เรียบร้อยแล้ว");
                          } catch (error: unknown) {
                            await showErrorAlert(
                              "คัดลอกลิงก์ไม่สำเร็จ",
                              getThaiAlertMessage(error, "คัดลอกลิงก์ไม่สำเร็จ"),
                            );
                          }
                        }}
                        className="inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-700 transition hover:bg-sky-100"
                      >
                        <Copy className="h-4 w-4" />
                        คัดลอก
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-dashed border-sky-200 bg-white p-4 text-sm leading-6 text-slate-500">
                    ยังไม่มีลิงก์การประเมินสำหรับหน่วยงานนี้
                  </div>
                )}
              </div>

              <div className="rounded-[26px] border border-slate-200/80 bg-white/95 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Download className="h-4 w-4 text-sky-600" />
                  ดาวน์โหลด QR Code
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  กดปุ่มด้านล่างเพื่อดาวน์โหลดรูป QR Code ของหน่วยงานนี้
                </p>

                {isQrReady && dept.image_path ? (
                  <button
                    type="button"
                    onClick={() => handleDownload(dept.image_path!, `qrcode_${dept.name.replace(/\s+/g, "_")}.png`)}
                    disabled={busy || resetting}
                    className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sky-600 to-blue-600 px-5 py-3 font-semibold text-white shadow-[0_16px_35px_rgba(37,99,235,0.22)] transition hover:from-sky-500 hover:to-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Download className="h-4 w-4" />
                    {busy ? "กำลังดาวน์โหลด..." : "ดาวน์โหลด QR Code"}
                  </button>
                ) : null}
              </div>

              <div className="rounded-[26px] border border-rose-100/80 bg-gradient-to-b from-rose-50/80 to-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
                <div className="flex items-center gap-2 text-sm font-semibold text-rose-700">
                  <RefreshCw className="h-4 w-4" />
                  {resetActionLabel} QR Code หน่วยงาน
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  หาก QR Code มีปัญหา สามารถกดรีเซตเพื่อสร้างคิวอาร์โค้ดใหม่จากลิงก์เดิมได้ทันที
                  {!isQrReady ? " หากยังไม่มี QR Code ระบบจะสร้างให้ใหม่ด้วย" : ""}
                </p>

                <button
                  type="button"
                  onClick={handleResetQr}
                  disabled={busy || resetting}
                  className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose-600 to-red-600 px-5 py-3 font-semibold text-white shadow-[0_16px_35px_rgba(220,38,38,0.20)] transition hover:from-rose-500 hover:to-red-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {resetting ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-transparent" />
                      กำลังรีเซต...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4" />
                      {resetActionLabel} QR Code
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>

      {preview ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
          onClick={() => setPreview(null)}
        >
          <div
            className="w-full max-w-md rounded-[28px] border border-sky-100 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.22)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="truncate pr-4 font-bold text-gray-900">
                QR Code: {preview.name}
              </h3>
              <button
                onClick={() => setPreview(null)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 text-transparent transition before:content-['×'] before:text-lg before:font-bold before:text-slate-500 hover:bg-slate-100"
              >
                ×
              </button>
            </div>
            <div className="aspect-square w-full overflow-hidden rounded-[24px] border border-sky-100 bg-gradient-to-b from-sky-50 to-white p-4">
              <img
                src={preview.url}
                alt={preview.name}
                className="h-full w-full object-contain"
              />
            </div>
            <div className="mt-4 break-all rounded-2xl border border-slate-200 bg-slate-50 p-3 text-center text-xs text-slate-500">
              {preview.link}
            </div>
            <div className="mt-5 flex justify-center">
              <button
                onClick={() => setPreview(null)}
                className="w-full rounded-2xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      ) : null}

    </main>
  );
}
