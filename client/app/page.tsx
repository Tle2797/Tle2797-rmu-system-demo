// client/app/page.tsx

/**
 * หน้าแรกของระบบ RMU Survey
 * - ใช้ทดสอบการเชื่อมต่อ backend
 * - ต่อไปสามารถพัฒนาเป็นหน้าแนะนำระบบได้
 */

import { apiGet } from "@/lib/api";

export default async function HomePage() {
  // เรียก API health เพื่อตรวจสอบว่า backend ทำงานอยู่
  const data = await apiGet<{ status: string}>("/health");

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6">
      <div className="bg-white shadow-lg rounded-xl p-6 w-full max-w-xl">
        <h1 className="text-2xl font-bold text-blue-700 mb-4">
          RMU Survey System
        </h1>

        <p className="text-gray-600 mb-4">
          ระบบประเมินการให้บริการหน่วยงาน มหาวิทยาลัยราชภัฏมหาสารคาม
        </p>

        {/* แสดงผลลัพธ์จาก backend */}
        <div className="bg-gray-100 rounded-lg p-4 text-sm">
          <pre className="text-gray-800">{JSON.stringify(data, null, 2)}</pre>
        </div>

        <a href="/survey" 
          className="inline-block mt-6 text-center w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition">
            ไปที่หน้าทำแบบประเมิน
        </a>
      </div>
    </main>
  );
}