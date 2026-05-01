"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, KeyRound, RefreshCcw } from "lucide-react";
import Swal from "sweetalert2";
import { apiPost } from "@/lib/api";
import { getThaiAlertMessage } from "@/lib/alert-message";

type VerifyOtpRes = {
  resetToken: string;
  user: {
    username: string;
    email: string | null;
    title: string | null;
    firstName: string | null;
    lastName: string | null;
  };
};

export default function VerifyOtpPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    const savedEmail = sessionStorage.getItem("passwordResetEmail") || "";
    setEmail(savedEmail);
    if (!savedEmail) router.replace("/forgot-password");
  }, [router]);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();

    if (!email || otp.length !== 6) {
      await Swal.fire({
        icon: "warning",
        title: "กรอก OTP",
        text: "กรุณากรอกรหัส OTP 6 หลัก",
        confirmButtonText: "ตกลง",
        confirmButtonColor: "#0369a1",
      });
      return;
    }

    setLoading(true);

    try {
      const res = await apiPost<VerifyOtpRes>(
        "/api/auth/forgot-password/verify-otp",
        { email, otp },
      );

      sessionStorage.setItem("passwordResetToken", res.resetToken);
      sessionStorage.setItem("passwordResetUser", JSON.stringify(res.user));

      router.push("/reset-password");
    } catch (err: unknown) {
      await Swal.fire({
        icon: "error",
        title: "ยืนยัน OTP ไม่สำเร็จ",
        text: getThaiAlertMessage(err, "OTP ไม่ถูกต้องหรือหมดอายุ"),
        confirmButtonText: "ตกลง",
        confirmButtonColor: "#0369a1",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (!email) return;

    setResending(true);

    try {
      await apiPost("/api/auth/forgot-password/request-otp", { email });
      await Swal.fire({
        icon: "success",
        title: "ส่ง OTP อีกครั้งแล้ว",
        text: "กรุณาตรวจสอบอีเมลของคุณ",
        timer: 1400,
        showConfirmButton: false,
      });
    } catch (err: unknown) {
      await Swal.fire({
        icon: "error",
        title: "ส่ง OTP ไม่สำเร็จ",
        text: getThaiAlertMessage(err, "กรุณารอสักครู่แล้วลองใหม่"),
        confirmButtonText: "ตกลง",
        confirmButtonColor: "#0369a1",
      });
    } finally {
      setResending(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-sky-50 via-white to-blue-50 px-6 py-10 font-sans">
      <section className="w-full max-w-md rounded-3xl border border-sky-100 bg-white p-8 shadow-[0_16px_50px_rgba(15,23,42,0.08)]">
        <Link
          href="/forgot-password"
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-sky-700"
        >
          <ArrowLeft size={16} />
          แก้ไขอีเมล
        </Link>

        <div className="mb-7 flex flex-col items-center text-center">
          <Image
            src="/logos/rmu.png"
            alt="RMU"
            width={76}
            height={76}
            className="mb-4 object-contain"
            priority
          />
          <h1 className="text-2xl font-bold text-slate-800">ยืนยัน OTP</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            กรอกรหัส 6 หลักที่ส่งไปยัง {email || "อีเมลของคุณ"}
          </p>
        </div>

        <form onSubmit={handleVerify} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              รหัส OTP
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                <KeyRound size={17} />
              </span>
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={otp}
                onChange={(e) =>
                  setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                placeholder="000000"
                suppressHydrationWarning
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-center text-lg font-semibold tracking-[0.35em] text-slate-800 outline-none transition placeholder:text-slate-300 focus:border-sky-500 focus:bg-white focus:ring-4 focus:ring-sky-100"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            suppressHydrationWarning
            className={`h-11 w-full rounded-xl text-sm font-semibold shadow-sm transition ${
              loading
                ? "cursor-not-allowed bg-slate-100 text-slate-400"
                : "bg-sky-700 text-white hover:bg-sky-800 focus:outline-none focus:ring-4 focus:ring-sky-100"
            }`}
          >
            {loading ? "กำลังตรวจสอบ..." : "ยืนยัน OTP"}
          </button>
        </form>

        <button
          type="button"
          disabled={resending}
          onClick={handleResend}
          suppressHydrationWarning
          className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 transition hover:border-sky-200 hover:text-sky-700 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
        >
          <RefreshCcw size={15} />
          {resending ? "กำลังส่งใหม่..." : "ส่ง OTP อีกครั้ง"}
        </button>
      </section>
    </main>
  );
}
