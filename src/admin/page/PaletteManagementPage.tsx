import { useState } from "react";

// ==========================================
// 1. 타입 정의 (Interfaces)
// ==========================================
interface PaletteItem {
  id: string;
  name: string;
  creator: string;
  colors: string[];          // 색상 HEX 코드 배열
  isOfficial: boolean;       // 공식 팔레트 등록 여부
  isFeatured: boolean;       // 추천 팔레트 노출 여부
  useCount: number;          // 색상 데이터 분석: 활용 수
  similarityScore: number;   // 유사도 검사 점수 (%)
  suspectedPlagiarism: boolean; // 도용 의심 여부
  createdAt: string;
}

type TabType = 'preset' | 'analytics' | 'copyright';

// ==========================================
// 2. 프로토타입용 더미 데이터
// ==========================================
const initialPalettes: PaletteItem[] = [
  { id: 'p1', name: '레트로 8비트 오락실 프리셋', creator: '운영자', colors: ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF'], isOfficial: true, isFeatured: true, useCount: 14250, similarityScore: 12, suspectedPlagiarism: false, createdAt: '2026-01-10' },
  { id: 'p2', name: '사이버펑크 네온 다크', creator: '네온마스터', colors: ['#0d0221', '#241468', '#9f0d7f', '#ea1179', '#f79ac0'], isOfficial: false, isFeatured: true, useCount: 8940, similarityScore: 35, suspectedPlagiarism: false, createdAt: '2026-04-12' },
  { id: 'p3', name: '파스텔 소프트 코랄 가든', creator: '민트초코', colors: ['#ffb7b2', '#ffdac1', '#e2f0cb', '#b5ead7', '#c7ceea'], isOfficial: false, isFeatured: false, useCount: 3120, similarityScore: 92, suspectedPlagiarism: true, createdAt: '2026-05-19' },
  { id: 'p4', name: '클래식 GameBoy 모노크롬', creator: '운영자', colors: ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'], isOfficial: true, isFeatured: false, useCount: 11020, similarityScore: 5, suspectedPlagiarism: false, createdAt: '2026-02-01' },
  { id: 'p5', name: '빈티지 가을 낙엽 스타일', creator: '가을남자', colors: ['#6f4e37', '#a67c52', '#b8860b', '#d2b48c', '#8b0000'], isOfficial: false, isFeatured: false, useCount: 1450, similarityScore: 88, suspectedPlagiarism: true, createdAt: '2026-05-22' },
];

// ==========================================
// 3. 메인 컴포넌트
// ==========================================
const PaletteManagementPage: React.FC = () => {
  // 상태 관리 (State)
  const [activeTab, setActiveTab] = useState<TabType>('preset');
  const [palettes, setPalettes] = useState<PaletteItem[]>(initialPalettes);

  // [기능 함수] 공식 팔레트 지정 토글
  const toggleOfficial = (id: string) => {
    setPalettes(prev => prev.map(p => p.id === id ? { ...p, isOfficial: !p.isOfficial } : p));
  };

  // [기능 함수] 추천 팔레트 노출 토글
  const toggleFeatured = (id: string) => {
    setPalettes(prev => prev.map(p => p.id === id ? { ...p, isFeatured: !p.isFeatured } : p));
  };


  return (
    <div style={styles.container}>
      {/* 상단 헤더 */}
      <header style={styles.header}>
        <h1 style={styles.headerTitle}>🎨 컬러 팔레트 관리 시스템</h1>
        <p style={styles.headerSub}>공식 프리셋 지정, 색상 데이터 통계 분석 및 저작권·유사도 도용 리스크를 감독합니다.</p>
      </header>

      {/* 내부 서브 탭 메뉴 */}
      <div style={styles.tabMenu}>
        <button style={activeTab === 'preset' ? styles.activeTabBtn : styles.tabBtn} onClick={() => setActiveTab('preset')}>
          🛠️ 마스터 팔레트 & 프리셋 관리
        </button>
        <button style={activeTab === 'analytics' ? styles.activeTabBtn : styles.tabBtn} onClick={() => setActiveTab('analytics')}>
          📊 색상 데이터 분석 & 최적화
        </button>
      </div>

      {/* ======================================================= */}
      {/* 1. 마스터 팔레트 및 프리셋 관리                         */}
      {/* ======================================================= */}
      {activeTab === 'preset' && (
        <section style={styles.sectionCard}>
          <h2 style={styles.sectionTitle}>공식 및 추천 프리셋 제어 테이블</h2>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>팔레트 명칭 / 등록자</th>
                <th style={styles.th}>색상 구성 프리뷰 (Color Chips)</th>
                <th style={styles.th}>등록일</th>
                <th style={styles.th}>공식 팔레트 지정</th>
                <th style={styles.th}>추천 팔레트 노출</th>
              </tr>
            </thead>
            <tbody>
              {palettes.map(p => (
                <tr key={p.id} style={styles.tr}>
                  <td style={styles.td}>
                    <div style={{ fontWeight: '600', color: '#1e293b' }}>{p.name}</div>
                    <div style={styles.subText}>by {p.creator}</div>
                  </td>
                  <td style={styles.td}>
                    {/* 색상 가상 설계도 데이터(배열)를 기반으로 컬러 칩 생성 */}
                    <div style={styles.colorBar}>
                      {p.colors.map((color, idx) => (
                        <div 
                          key={idx} 
                          style={{ ...styles.colorChip, backgroundColor: color }} 
                          title={color} 
                        />
                      ))}
                    </div>
                  </td>
                  <td style={styles.td}>{p.createdAt}</td>
                  <td style={styles.td}>
                    <button 
                      style={p.isOfficial ? styles.btnPurple : styles.btnGray}
                      onClick={() => toggleOfficial(p.id)}
                    >
                      {p.isOfficial ? '👑 공식 지정됨' : '일반 등록'}
                    </button>
                  </td>
                  <td style={styles.td}>
                    <button 
                      style={p.isFeatured ? styles.btnWarning : styles.btnGray}
                      onClick={() => toggleFeatured(p.id)}
                    >
                      {p.isFeatured ? '★ 메인 노출 중' : '노출 제외'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* ======================================================= */}
      {/* 2. 색상 데이터 분석 및 최적화                           */}
      {/* ======================================================= */}
      {activeTab === 'analytics' && (
        <section style={styles.sectionCard}>
          <h2 style={styles.sectionTitle}>팔레트 데이터 조회 및 활용도 통계 분석</h2>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>순위</th>
                <th style={styles.th}>팔레트 명칭</th>
                <th style={styles.th}>색상 스키마</th>
                <th style={styles.th}>유저 누적 에셋/아트 활용 횟수</th>
                <th style={styles.th}>최적화 상태</th>
              </tr>
            </thead>
            <tbody>
              {[...palettes].sort((a,b) => b.useCount - a.useCount).map((p, index) => (
                <tr key={p.id} style={styles.tr}>
                  <td style={{ ...styles.td, fontWeight: 'bold', color: '#4f46e5' }}>{index + 1}위</td>
                  <td style={styles.td}>
                    <span style={{ fontWeight: '500' }}>{p.name}</span>
                  </td>
                  <td style={styles.td}>
                    <div style={styles.colorBar}>
                      {p.colors.map((color, idx) => (
                        <div key={idx} style={{ ...styles.colorChipSmall, backgroundColor: color }} />
                      ))}
                    </div>
                  </td>
                  <td style={{ ...styles.td, fontWeight: '600', color: '#1e293b' }}>
                    {p.useCount.toLocaleString()}회 분산 활용됨
                  </td>
                  <td style={styles.td}>
                    <span style={p.useCount > 8000 ? styles.badgeSuccess : styles.badgeNormal}>
                      {p.useCount > 8000 ? '🔥 고빈도 최적화 대상' : '안정 상태'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
};

// ==========================================
// 4. 인라인 스타일 가이드 객체
// ==========================================
const styles: { [key: string]: React.CSSProperties } = {
  container: { padding: '24px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', color: '#333', backgroundColor: '#f8fafc', minHeight: '100vh' },
  header: { marginBottom: '24px', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' },
  headerTitle: { margin: '0 0 8px 0', fontSize: '24px', color: '#1e293b' },
  headerSub: { margin: 0, color: '#64748b', fontSize: '14px' },
  tabMenu: { display: 'flex', gap: '12px', marginBottom: '20px', borderBottom: '2px solid #e2e8f0' },
  
  tabBtn: { padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer', color: '#64748b', fontSize: '14px', borderBottom: '3px solid transparent', fontWeight: '500' },
  activeTabBtn: { padding: '12px 20px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '16px', color: '#4f46e5', fontWeight: 'bold', borderBottom: '3px solid #4f46e5' },
  sectionCard: { backgroundColor: '#fff', borderRadius: '8px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },
  sectionTitle: { fontSize: '16px', margin: '0 0 16px 0', color: '#1e293b' },
  table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' },
  th: { padding: '12px', borderBottom: '2px solid #e2e8f0', color: '#64748b', fontWeight: '600', backgroundColor: '#f8fafc' },
  tr: { borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.2s' },
  td: { padding: '12px', verticalAlign: 'middle' },
  subText: { fontSize: '12px', color: '#94a3b8', marginTop: '2px' },
  colorBar: { display: 'flex', gap: '3px', backgroundColor: '#f1f5f9', padding: '4px', borderRadius: '6px', width: 'fit-content' },
  colorChip: { width: '24px', height: '24px', borderRadius: '4px', border: '1px solid rgba(0,0,0,0.1)' },
  colorChipSmall: { width: '16px', height: '16px', borderRadius: '3px', border: '1px solid rgba(0,0,0,0.1)' },
  btnPurple: { padding: '6px 12px', backgroundColor: '#6366f1', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' },
  btnWarning: { padding: '6px 12px', backgroundColor: '#f59e0b', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' },
  btnGray: { padding: '6px 12px', backgroundColor: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' },
  badgeSuccess: { backgroundColor: '#d1fae5', color: '#065f46', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '600' },
  badgeNormal: { backgroundColor: '#f1f5f9', color: '#475569', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' },
  badgeDanger: { backgroundColor: '#fee2e2', color: '#dc2626', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '600' },
  btnDangerAction: { padding: '6px 10px', backgroundColor: '#dc2626', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' },
  btnGrayAction: { padding: '6px 10px', backgroundColor: '#fff', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }
};
export default PaletteManagementPage;