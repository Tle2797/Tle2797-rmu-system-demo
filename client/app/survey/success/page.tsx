// client/app/survey/success/page/tsx

/**
 * หน้าแสดงผลหลังส่งแบบประเมินสำเร็จ
 * - Server Component (ไม่มี state)
 * - ดีไซน์ทางการ เหมาะกับระบบมหาวิทยาลัย
 * - Responsive: Mobile / iPhone / iPad / Tablet / Desktop
 */

export default function SurveySuccessPage() {
  return (
    <main className="min-h-screen bg-linear-to-b from-blue-50 to-gray-100 flex items-center justify-center px-4 py-10"
>
      {/* Card */}
      <div className="w-full max-w-md sm:max-w-lg bg-white rounded-2xl shadow-lg px-6 sm:px-10 py-8 sm:py-10 text-center">
        
        {/* Icon */}
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <svg
            className="h-8 w-8 text-green-600"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>

        {/* Title */}
        <h1 className="text-xl sm:text-2xl font-bold text-green-700 mb-3">
          ส่งแบบประเมินเรียบร้อยแล้ว
        </h1>

        {/* Description */}
        <p className="text-sm sm:text-base text-gray-700 leading-relaxed mb-6">
          ระบบได้บันทึกผลการประเมินของท่านเรียบร้อยแล้ว
          <br className="hidden sm:block" />
          ขอขอบคุณที่สละเวลาในการประเมินการให้บริการของหน่วยงาน
        </p>

      </div>
    </main>
  );
}
