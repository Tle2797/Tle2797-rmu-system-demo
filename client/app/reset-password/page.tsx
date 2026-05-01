"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, EyeOff, Lock } from "lucide-react";
import Swal from "sweetalert2";
import { apiPost } from "@/lib/api";
import { getThaiAlertMessage } from "@/lib/alert-message";

type ResetUserInfo = {
  username: string;
  email: string | null;
  title: string | null;
  firstName: string | null;
  lastName: string | null;
};

export default function ResetPasswordPage() {
  const router = useRouter();
  const [resetToken, setResetToken] = useState("");
  const [userInfo, setUserInfo] = useState<ResetUserInfo | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const savedToken = sessionStorage.getItem("passwordResetToken") || "";
    const savedUser = sessionStorage.getItem("passwordResetUser");

    setResetToken(savedToken);
    if (savedUser) {
      try {
        setUserInfo(JSON.parse(savedUser) as ResetUserInfo);
      } catch {
        sessionStorage.removeItem("passwordResetUser");
      }
    }

    if (!savedToken) router.replace("/forgot-password");
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!password || !confirmPassword) {
      await Swal.fire({
        icon: "warning",
        title: "กรอกรหัสผ่าน",
        text: "กรุณากรอกรหัสผ่านใหม่และยืนยันรหัสผ่าน",
        confirmButtonText: "ตกลง",
        confirmButtonColor: "#0369a1",
      });
      return;
    }

    if (password.length < 8) {
      await Swal.fire({
        icon: "warning",
        title: "รหัสผ่านสั้นเกินไป",
        text: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร",
        confirmButtonText: "ตกลง",
        confirmButtonColor: "#0369a1",
      });
      return;
    }

    if (password !== confirmPassword) {
      await Swal.fire({
        icon: "warning",
        title: "รหัสผ่านไม่ตรงกัน",
        text: "กรุณายืนยันรหัสผ่านให้ตรงกัน",
        confirmButtonText: "ตกลง",
        confirmButtonColor: "#0369a1",
      });
      return;
    }

    setLoading(true);

    try {
      await apiPost("/api/auth/forgot-password/reset", {
        resetToken,
        password,
      });

      sessionStorage.removeItem("passwordResetEmail");
      sessionStorage.removeItem("passwordResetToken");
      sessionStorage.removeItem("passwordResetUser");

      await Swal.fire({
        icon: "success",
        title: "ตั้งรหัสผ่านใหม่สำเร็จ",
        text: "กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่",
        confirmButtonText: "ไปหน้าเข้าสู่ระบบ",
        confirmButtonColor: "#0369a1",
      });

      router.replace("/login");
    } catch (err: unknown) {
      await Swal.fire({
        icon: "error",
        title: "ตั้งรหัสผ่านไม่สำเร็จ",
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
          href="/forgot-password/verify"
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-sky-700"
        >
          <ArrowLeft size={16} />
          กลับไปยืนยัน OTP
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
          <h1 className="text-2xl font-bold text-slate-800">
            ตั้งรหัสผ่านใหม่
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            กำหนดรหัสผ่านใหม่สำหรับบัญชีของคุณ
          </p>
        </div>

        {userInfo ? (
          <div className="mb-5 rounded-2xl border border-sky-100 bg-sky-50/70 p-4">
            <p className="mb-3 text-sm font-semibold text-slate-700">
              ข้อมูลบัญชีผู้ใช้
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex items-start justify-between gap-4">
                <span className="text-slate-500">ชื่อผู้ใช้</span>
                <span className="break-all text-right font-semibold text-slate-800">
                  {userInfo.username}
                </span>
              </div>
              <div className="flex items-start justify-between gap-4">
                <span className="text-slate-500">อีเมล</span>
                <span className="break-all text-right font-medium text-slate-700">
                  {userInfo.email || "-"}
                </span>
              </div>
              <div className="flex items-start justify-between gap-4">
                <span className="text-slate-500">ชื่อ-นามสกุล</span>
                <span className="text-right font-medium text-slate-700">
                  {[userInfo.title, userInfo.firstName, userInfo.lastName]
                    .filter(Boolean)
                    .join(" ") || "-"}
                </span>
              </div>
            </div>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              รหัสผ่านใหม่
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                <Lock size={17} />
              </span>
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="อย่างน้อย 8 ตัวอักษร"
                suppressHydrationWarning
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-11 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:bg-white focus:ring-4 focus:ring-sky-100"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword((value) => !value)}
                suppressHydrationWarning
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-sky-700"
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              ยืนยันรหัสผ่าน
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                <Lock size={17} />
              </span>
              <input
                type={showConfirmPassword ? "text" : "password"}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="กรอกรหัสผ่านอีกครั้ง"
                suppressHydrationWarning
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-11 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:bg-white focus:ring-4 focus:ring-sky-100"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowConfirmPassword((value) => !value)}
                suppressHydrationWarning
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-sky-700"
              >
                {showConfirmPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
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
            {loading ? "กำลังบันทึก..." : "บันทึกรหัสผ่านใหม่"}
          </button>
        </form>
      </section>
    </main>
  );
}
