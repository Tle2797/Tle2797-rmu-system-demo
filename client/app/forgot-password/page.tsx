"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Mail } from "lucide-react";
import Swal from "sweetalert2";
import { apiPost } from "@/lib/api";
import { getThaiAlertMessage } from "@/lib/alert-message";

type RequestOtpRes = {
  message: string;
};

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      await Swal.fire({
        icon: "warning",
        title: "กรอกอีเมล",
        text: "กรุณากรอกอีเมลที่ใช้ในระบบ",
        confirmButtonText: "ตกลง",
        confirmButtonColor: "#0369a1",
      });
      return;
    }

    setLoading(true);

    try {
      await apiPost<RequestOtpRes>("/api/auth/forgot-password/request-otp", {
        email: normalizedEmail,
      });

      sessionStorage.setItem("passwordResetEmail", normalizedEmail);

      await Swal.fire({
        icon: "success",
        title: "ส่งรหัส OTP แล้ว",
        text: "กรุณาตรวจสอบอีเมลของคุณ",
        timer: 1400,
        showConfirmButton: false,
      });

      router.push("/forgot-password/verify");
    } catch (err: unknown) {
      await Swal.fire({
        icon: "error",
        title: "ส่ง OTP ไม่สำเร็จ",
        text: getThaiAlertMessage(err, "กรุณาลองใหม่อีกครั้ง"),
        confirmButtonText: "ตกลง",
        confirmButtonColor: "#0369a1",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-sky-50 via-white to-blue-50 px-6 py-10 font-sans">
      <section className="w-full max-w-md rounded-3xl border border-sky-100 bg-white p-8 shadow-[0_16px_50px_rgba(15,23,42,0.08)]">
        <Link
          href="/login"
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-sky-700"
        >
          <ArrowLeft size={16} />
          กลับหน้าเข้าสู่ระบบ
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
          <h1 className="text-2xl font-bold text-slate-800">ลืมรหัสผ่าน</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            กรอกอีเมลของบัญชีผู้ใช้เพื่อรับรหัส OTP
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              อีเมล
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                <Mail size={17} />
              </span>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@rmu.ac.th"
                suppressHydrationWarning
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:bg-white focus:ring-4 focus:ring-sky-100"
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
            {loading ? "กำลังส่ง OTP..." : "ส่งรหัส OTP"}
          </button>
        </form>
      </section>
    </main>
  );
}
