"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { SIDEBAR_MENU, Role, SidebarItem } from "./sidebar.config";
import Swal from "sweetalert2";

type SidebarProps = {
  role: Role;
  departmentId?: number;
};

const menuItemBase =
  "group flex items-center gap-2 rounded-xl border border-transparent px-3 py-2 text-[13.5px] font-medium transition-colors";
const menuItemInactive =
  "text-slate-600 hover:bg-sky-50/80 hover:text-blue-700";
const menuItemActive =
  "bg-white/95 text-blue-700 font-semibold border-blue-200/70 shadow-[0_8px_22px_rgba(37,99,235,0.10)]";
const menuIconBase = "h-[17px] w-[17px] shrink-0 transition-colors";
const menuPillBase =
  "h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500 transition-opacity";

export default function Sidebar({
  role,
  departmentId,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const menu = SIDEBAR_MENU[role] ?? [];
  const isDeptRole = role === "dept_head" || role === "staff";

  const buildHref = (item: SidebarItem) => {
    if (!isDeptRole || !departmentId || item.appendDepartmentId === false) {
      return item.path;
    }
    if (item.path === "/dashboard/profile") return item.path;
    return `${item.path}/${departmentId}`;
  };

  const isActiveMenu = (item: SidebarItem) => {
    const excludedPaths = item.excludePaths ?? [];
    if (excludedPaths.some((p) => pathname.startsWith(p))) {
      return false;
    }
    const pathsToMatch = item.matchPaths ?? [item.path];
    return pathsToMatch.some((p) => pathname.startsWith(p));
  };

  const handleLogout = async () => {
    const result = await Swal.fire({
      icon: "question",
      title: "ออกจากระบบ",
      text: "คุณต้องการออกจากระบบนี้หรือไม่",
      showCancelButton: true,
      confirmButtonText: "ออกจากระบบ",
      cancelButtonText: "ยกเลิก",
      focusCancel: true,
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#0369a1",
      customClass: {
        popup:
          "rounded-3xl border border-sky-100 shadow-[0_24px_80px_rgba(15,23,42,0.14)]",
        title: "text-xl font-semibold text-slate-900",
        htmlContainer: "text-sm leading-6 text-slate-500",
      },
    });

    if (!result.isConfirmed) return;
    localStorage.removeItem("token");
    router.replace("/login");
  };

  const roleLabel: Record<Role, string> = {
    admin: "แอดมิน",
    exec: "ผู้บริหาร",
    dept_head: "หัวหน้าหน่วยงาน",
    staff: "เจ้าหน้าที่หน่วยงาน",
  };

  return (
    <aside className="font-sans sticky top-0 flex h-screen w-[260px] shrink-0 flex-col border-r border-sky-200/60 bg-gradient-to-b from-sky-50 to-white shadow-[inset_-1px_0_0_rgba(255,255,255,0.6)] backdrop-blur-md">
      <div className="shrink-0 bg-gradient-to-br from-sky-500 to-blue-600 px-5 py-[22px] shadow-[inset_0_-1px_0_rgba(255,255,255,0.14)]">
        <div className="flex items-center gap-3.5">
          <div className="flex h-[52px] w-[52px] shrink-0 items-center justify-center">
            <Image
              src="/logos/rmu.png"
              alt="RMU Logo"
              width={52}
              height={52}
              className="h-[52px] w-[52px] object-contain"
              priority
            />
          </div>
          <div className="min-w-0 space-y-0.5">
            <div className="text-[16px] font-semibold leading-[1.1] tracking-[-0.25px] text-white">
              RMU Satisfaction
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] leading-[1.45] text-white/80">
              <span className="font-medium text-white/90">
                ระบบประเมินความพึงพอใจ
              </span>
              <span className="font-semibold text-white/95">
                ตำแหน่ง : {roleLabel[role]}
              </span>
            </div>
          </div>
        </div>
      </div>

      <nav
        className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-2.5 py-3.5"
        aria-label="Sidebar navigation"
      >
        {menu.map((item, idx) => {
          const active = isActiveMenu(item);
          const href = buildHref(item);
          const prevItem = menu[idx - 1];
          const showDivider =
            idx > 0 &&
            item.group !== undefined &&
            prevItem?.group !== item.group;

          return (
            <div key={item.path}>
              {showDivider && (
                <div className="mx-2 my-0 h-px bg-sky-100/80" />
              )}
              <Link
                href={href}
                className={`${menuItemBase} ${
                  active ? menuItemActive : menuItemInactive
                }`}
              >
                {item.icon && (
                  <item.icon
                    className={`${menuIconBase} ${
                      active
                        ? "text-blue-700"
                        : "text-slate-400 group-hover:text-blue-700"
                    }`}
                  />
                )}
                <span className="flex-1">{item.label}</span>
                <span
                  className={`${menuPillBase} ${
                    active ? "opacity-100" : "opacity-0"
                  }`}
                />
              </Link>
            </div>
          );
        })}
      </nav>

      <div className="px-2.5 pb-4 pt-2">
        <div className="mx-3 mb-3 h-px bg-sky-200/80" />
        <button
          type="button"
          onClick={handleLogout}
          className="relative flex w-full items-center rounded-xl border border-red-300/60 bg-gradient-to-r from-red-500 to-red-600 px-3.5 py-2.5 text-[13px] font-medium text-white transition-colors hover:from-red-400 hover:to-red-500 hover:border-red-300/80"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="absolute left-3.5 top-1/2 h-[15px] w-[15px] -translate-y-1/2 shrink-0 text-white"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          <span className="w-full text-center">ออกจากระบบ</span>
        </button>
      </div>
    </aside>
  );
}
