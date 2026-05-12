import React from 'react';
import { 
  Users, ShoppingCart, AlertCircle, Wallet, 
  ArrowUpRight, ArrowDownRight, CheckCircle2, XCircle 
} from 'lucide-react';

// --- 가상 데이터 (데이터가 없을 때를 대비한 샘플) ---
const SUMMARY_STATS = [
  { id: 1, label: '신규 가입자', value: '128명', change: '+12%', isUp: true, icon: Users, color: 'text-blue-600' },
  { id: 2, label: '당일 매출', value: '₩1,240,000', change: '+5%', isUp: true, icon: ShoppingCart, color: 'text-green-600' },
  { id: 3, label: '미처리 신고', value: '14건', change: '-2건', isUp: false, icon: AlertCircle, color: 'text-red-600' },
  { id: 4, label: '정산 대기액', value: '₩3,450,000', change: '신규 5건', isUp: true, icon: Wallet, color: 'text-purple-600' },
];

const RECENT_REPORTS = [
  { id: 1, type: '저작권 침해', target: 'Knight_Sprite.png', status: '대기', time: '10분 전' },
  { id: 2, type: '부적절한 언어', target: '댓글#123', status: '검토중', time: '34분 전' },
];

export default function AdminDashboardPage(){

    return (
    <div className="p-6 bg-gray-50 min-h-screen space-y-8">
      <h1 className="text-2xl font-bold text-gray-800">종합 대시보드</h1>

      {/* 1. 상단 요약 (Summary Stats) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {SUMMARY_STATS.map((stat) => (
          <div key={stat.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium">{stat.label}</p>
              <h3 className="text-2xl font-bold mt-1">{stat.value}</h3>
              <div className={`flex items-center mt-2 text-xs font-semibold ${stat.isUp ? 'text-green-500' : 'text-red-500'}`}>
                {stat.isUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                <span className="ml-1">{stat.change}</span>
              </div>
            </div>
            <div className={`p-3 rounded-lg bg-gray-50 ${stat.color}`}>
              <stat.icon size={24} />
            </div>
          </div>
        ))}
      </div>

      {/* 2. 중단 그래프 영역 (Placeholder) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-64 flex flex-col items-center justify-center border-dashed border-2">
          <p className="text-gray-400 font-medium">주간 매출 추이 그래프</p>
          <div className="w-full h-32 mt-4 bg-blue-50 rounded-lg flex items-end p-2 space-x-2">
             <div className="bg-blue-200 w-full h-1/2"></div>
             <div className="bg-blue-300 w-full h-3/4"></div>
             <div className="bg-blue-400 w-full h-full"></div>
             <div className="bg-blue-500 w-full h-2/3"></div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h4 className="font-bold mb-4">인기 태그 / 프로젝트 해상도 분포</h4>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1"><span>16x16</span><span>45%</span></div>
              <div className="w-full bg-gray-100 h-2 rounded-full"><div className="bg-blue-500 h-2 rounded-full w-[45%]"></div></div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1"><span>32x32</span><span>30%</span></div>
              <div className="w-full bg-gray-100 h-2 rounded-full"><div className="bg-green-500 h-2 rounded-full w-[30%]"></div></div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. 하단 리스트 (Listings) */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* 최근 신고 내역 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden col-span-1">
          <div className="p-4 border-b border-gray-50 flex justify-between items-center">
            <h4 className="font-bold text-gray-700">최근 신고 내역</h4>
            <button className="text-xs text-blue-600 hover:underline">모두보기</button>
          </div>
          <div className="divide-y divide-gray-50">
            {RECENT_REPORTS.map((report) => (
              <div key={report.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition">
                <div>
                  <p className="text-sm font-semibold">{report.target}</p>
                  <p className="text-xs text-gray-500">{report.type} • {report.time}</p>
                </div>
                <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-[10px] rounded-full font-bold">{report.status}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 출금 요청 및 AI 알림 (통합 예시) */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden col-span-2">
           <div className="p-4 border-b border-gray-50 bg-red-50">
             <h4 className="font-bold text-red-700 flex items-center gap-2">
               <AlertCircle size={18} /> 유사도 임계치 초과 알림 (AI)
             </h4>
           </div>
           <div className="p-4 space-y-4">
              <div className="flex items-center justify-between p-3 border border-red-100 rounded-lg bg-white">
                <div className="text-sm">
                   <strong>NeonBrush_final.png</strong>가 기존 에셋과 <strong>94% 유사함</strong>
                </div>
                <div className="flex gap-2">
                   <button className="p-2 text-green-600 hover:bg-green-50 rounded"><CheckCircle2 size={20}/></button>
                   <button className="p-2 text-red-600 hover:bg-red-50 rounded"><XCircle size={20}/></button>
                </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
