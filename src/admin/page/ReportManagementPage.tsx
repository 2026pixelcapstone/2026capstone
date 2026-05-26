import React, { useState } from 'react';

// ==========================================
// 1. 타입 정의 (Interfaces)
// ==========================================
type ReportCategory = 'ALL' | 'SPAM' | 'COPYRIGHT' | 'ABUSE' | 'INAPPROPRIATE';
type PenaltyTargetScope = 'SINGLE' | 'ALL_POSTS'; // 소급 적용 여부 (해당 게시물만 vs 모든 게시물)

interface ReportItem {
  id: string;
  category: '스팸/도배' | '저작권 침해' | '욕설/비방' | '부적절한 콘텐츠';
  targetTitle: string;    // 신고된 대상 콘텐츠명
  targetType: '갤러리 아트' | '에셋 댓글' | '유저 프로필';
  reporter: string;       // 신고자
  reportedUser: string;   // 피신고자 (가해 유저)
  reason: string;         // 신고 상세 내용
  evidenceUrl: string;    // 증거물 링크/텍스트
  status: '대기중' | '처리완료' | '반려';
  createdAt: string;
}

// ==========================================
// 2. 프로토타입용 더미 데이터
// ==========================================
const initialReports: ReportItem[] = [
  { id: 'r1', category: '저작권 침해', targetType: '갤러리 아트', targetTitle: '파이널 판타지 스타일 도트 캐릭터 팩', reporter: 'pixel_guardian', reportedUser: 'copy_cat', reason: '해외 아티스트 외주 작업물을 본인이 찍은 것처럼 속여 유료 에셋으로 무단 재배포하고 있습니다.', evidenceUrl: 'https://evidence-link.com/original-source-path', status: '대기중', createdAt: '2026-05-25 10:20' },
  { id: 'r2', category: '욕설/비방', targetType: '에셋 댓글', targetTitle: '3D 던전 로우폴리 패키지', reporter: 'indie_dev1', reportedUser: 'troll_king', reason: '리뷰란에 근거 없는 비방과 함께 부모님 비하 욕설을 지속적으로 도배하고 있습니다.', evidenceUrl: '증거 스크린샷: "이딴 걸 돈 받고 파냐? 쓰레기 제작자 XX년아..."', status: '대기중', createdAt: '2026-05-26 09:15' },
  { id: 'r3', category: '스팸/도배', targetType: '유저 프로필', targetTitle: '광고성 계정 가입자', reporter: 'system_bot', reportedUser: 'casino_gambling', reason: '프로필 자기소개란에 불법 사설 토토 링크를 무차별적으로 기재하여 트래픽을 유도함.', evidenceUrl: '프로필 링크: "매일 첫충 20% 보장! 주소 클릭..."', status: '대기중', createdAt: '2026-05-26 13:02' },
  { id: 'r4', category: '부적절한 콘텐츠', targetType: '갤러리 아트', targetTitle: '잔혹한 고어 일러스트', reporter: 'user_99', reportedUser: 'dark_artist', reason: '연령 제한 필터링 없이 과도하게 잔혹하고 혐오감을 주는 고어 아트를 전체 공개로 업로드함.', evidenceUrl: '이미지 메타데이터 확인 결과 고수위 잔혹물 적발', status: '처리완료', createdAt: '2026-05-24 18:40' }
];

// ==========================================
// 3. 메인 컴포넌트
// ==========================================
const ReportManagementPage: React.FC = () => {
  // 상태 관리 (State)
  const [selectedCategory, setSelectedCategory] = useState<ReportCategory>('ALL');
  const [reports, setReports] = useState<ReportItem[]>(initialReports);
  const [selectedReport, setSelectedReport] = useState<ReportItem>(initialReports[0]);

  // 제재 조치 양식 폼 상태들
  const [penaltyLevel, setPenaltyLevel] = useState<string>('경고 조치');
  const [penaltyDuration, setPenaltyDuration] = useState<string>('3일 정지');
  const [retroactiveScope, setRetroactiveScope] = useState<PenaltyTargetScope>('SINGLE');
  const [adminComment, setAdminComment] = useState<string>('');

  // [기능 함수] 제재 처리 최종 승인 버튼
  const handleExecutePenalty = (status: '처리완료' | '반려') => {
    if (status === '처리완료' && !adminComment.trim()) {
      alert('⚠️ 제재 근거를 위한 관리자 코멘트를 입력해 주세요.');
      return;
    }

    // 1. 해당 신고 내역의 상태를 업데이트 (가상 돔 리렌더링 유발)
    setReports(prev => prev.map(item => 
      item.id === selectedReport.id ? { ...item, status: status } : item
    ));

    // 2. 가상으로 처리 결과 알림창 팝업
    alert(
      `[제재 처리 완료]\n` +
      `대상 유저: @${selectedReport.reportedUser}\n` +
      `처분 수위: ${penaltyLevel} (${penaltyDuration})\n` +
      `소급 적용: ${retroactiveScope === 'ALL_POSTS' ? '해당 유저의 모든 게시물 블라인드 소급 적용' : '해당 신고물 건만 단독 처리'}\n` +
      `관리자 코멘트: ${adminComment || '반려 처리됨'}`
    );

    // 폼 초기화
    setAdminComment('');
  };

  // 카테고리 필터링 로직
  const filteredReports = reports.filter(item => {
    if (selectedCategory === 'ALL') return true;
    if (selectedCategory === 'SPAM') return item.category === '스팸/도배';
    if (selectedCategory === 'COPYRIGHT') return item.category === '저작권 침해';
    if (selectedCategory === 'ABUSE') return item.category === '욕설/비방';
    if (selectedCategory === 'INAPPROPRIATE') return item.category === '부적절한 콘텐츠';
    return true;
  });

  return (
    <div style={styles.container}>
      {/* 상단 헤더 */}
      <header style={styles.header}>
        <h1 style={styles.headerTitle}>⚖️ 신고 및 제재 조치 센터</h1>
        <p style={styles.headerSub}>플랫폼 유해 콘텐츠 및 도용 신고를 검토하고 위반 수위에 따른 소급 제재를 집행합니다.</p>
      </header>

      {/* 대분류: 신고 분야 선택 바 */}
      <div style={styles.filterBar}>
        <button style={selectedCategory === 'ALL' ? styles.filterBtnActive : styles.filterBtn} onClick={() => setSelectedCategory('ALL')}>전체 보기</button>
        <button style={selectedCategory === 'COPYRIGHT' ? styles.filterBtnActive : styles.filterBtn} onClick={() => setSelectedCategory('COPYRIGHT')}>🚨 저작권 침해</button>
        <button style={selectedCategory === 'ABUSE' ? styles.filterBtnActive : styles.filterBtn} onClick={() => setSelectedCategory('ABUSE')}>🤬 욕설/비방</button>
        <button style={selectedCategory === 'SPAM' ? styles.filterBtnActive : styles.filterBtn} onClick={() => setSelectedCategory('SPAM')}>✉️ 스팸/도배</button>
        <button style={selectedCategory === 'INAPPROPRIATE' ? styles.filterBtnActive : styles.filterBtn} onClick={() => setSelectedCategory('INAPPROPRIATE')}>🔞 부적절물</button>
      </div>

      {/* 메인 2분할 레이아웃 */}
      <div style={styles.mainLayout}>
        
        {/* [좌측] 신고 리스트 테이블 */}
        <section style={styles.leftSection}>
          <h2 style={styles.sectionTitle}>신고 접수 내역 ({filteredReports.length}건)</h2>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>분야</th>
                <th style={styles.th}>신고 대상물</th>
                <th style={styles.th}>피신고자</th>
                <th style={styles.th}>접수일</th>
                <th style={styles.th}>상태</th>
              </tr>
            </thead>
            <tbody>
              {filteredReports.map(item => (
                <tr 
                  key={item.id}
                  style={{
                    ...styles.tr,
                    backgroundColor: selectedReport.id === item.id ? '#f0f4ff' : 'transparent',
                    fontWeight: selectedReport.id === item.id ? '600' : 'normal'
                  }}
                  onClick={() => setSelectedReport(item)}
                >
                  <td style={styles.td}>
                    <span style={item.category === '저작권 침해' ? styles.badgeRed : styles.badgeOrange}>
                      {item.category}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <div style={{ color: '#1e293b', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.targetTitle}</div>
                    <div style={styles.subText}>{item.targetType}</div>
                  </td>
                  <td style={styles.td}>@{item.reportedUser}</td>
                  <td style={styles.td}>{item.createdAt.split(' ')[0]}</td>
                  <td style={styles.td}>
                    <span style={item.status === '대기중' ? styles.statusWait : styles.statusDone}>
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* [우측] 해당 신고 내용 상세 및 증거물 보기 / 제재 집행 폼 */}
        <section style={styles.rightSection}>
          <div style={styles.stickyCard}>
            
            {/* 1. 증거물 조회 스페이스 */}
            <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '16px', marginBottom: '16px' }}>
              <h3 style={styles.sectionTitle}>📄 신고 사유 및 증거물 실사</h3>
              <div style={styles.evidenceBox}>
                <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#64748b' }}>
                  <strong>🗣️ 신고자 사유 (@{selectedReport.reporter}):</strong>
                </p>
                <p style={{ margin: '0 0 16px 0', fontSize: '14px', lineHeight: '1.5' }}>"{selectedReport.reason}"</p>
                
                <p style={{ margin: '0 0 6px 0', fontSize: '13px', color: '#dc2626' }}>
                  <strong>🔗 확보된 위반 증거물데이터:</strong>
                </p>
                <div style={styles.evidenceContent}>
                  {selectedReport.evidenceUrl}
                </div>
              </div>
            </div>

            {/* 2. 제재 처리 입력 폼 (이 값이 변경되면 해당 옵션 컴포넌트만 리렌더링됨) */}
            <div>
              <h3 style={styles.sectionTitle}>⚖️ 위반 수위 심사 및 제재 판단</h3>
              
              {/* 위반 수위 선택 */}
              <div style={styles.formGroup}>
                <label style={styles.label}>위반 수위 판단</label>
                <select style={styles.select} value={penaltyLevel} onChange={(e) => setPenaltyLevel(e.target.value)}>
                  <option value="경고 조치">경고 조치 (단순 단순 경고장 발송)</option>
                  <option value="서비스 이용 제한">서비스 이용 제한 (계정 동결)</option>
                  <option value="영구 마크다운">영구 마크다운 (영구 정지)</option>
                </select>
              </div>

              {/* 제재 기간 선택 */}
              <div style={styles.formGroup}>
                <label style={styles.label}>이용 제재 임기 기간</label>
                <select style={styles.select} value={penaltyDuration} onChange={(e) => setPenaltyDuration(e.target.value)}>
                  <option value="즉시 해제/주의">주의 권고 (기간 없음)</option>
                  <option value="3일 정지">3일 간 콘텐츠 업로드/댓글 제한</option>
                  <option value="7일 정지">7일 간 서비스 접근 제한</option>
                  <option value="30일 정지">30일 간 풀 액세스 차단</option>
                  <option value="영구 추방">영구 정지 (Permanent Ban)</option>
                </select>
              </div>

              {/* 소급 적용 여부 선택 인터페이스 */}
              <div style={styles.formGroup}>
                <label style={styles.label}>소급 적용 처분 선택 (중요)</label>
                <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
                  <label style={styles.radioLabel}>
                    <input 
                      type="radio" 
                      name="scope" 
                      checked={retroactiveScope === 'SINGLE'} 
                      onChange={() => setRetroactiveScope('SINGLE')} 
                    />
                    단독 처리 (문제가 된 것만 블라인드)
                  </label>
                  <label style={styles.radioLabel}>
                    <input 
                      type="radio" 
                      name="scope" 
                      checked={retroactiveScope === 'ALL_POSTS'} 
                      onChange={() => setRetroactiveScope('ALL_POSTS')} 
                    />
                    <span style={{ color: '#dc2626', fontWeight: '600' }}>전체 소급 (가해 유저의 모든 게시물 블라인드)</span>
                  </label>
                </div>
              </div>

              {/* 관리자 코멘트 기입란 */}
              <div style={styles.formGroup}>
                <label style={styles.label}>처리 근거 기술 (관리자 코멘트)</label>
                <textarea 
                  style={styles.textarea} 
                  placeholder="유저 서스펜드 이력 및 라이선스 약관 위반 증거 조항 번호를 명시해 주세요. 유저에게 처분 사유로 발송됩니다."
                  value={adminComment}
                  onChange={(e) => setAdminComment(e.target.value)}
                />
              </div>

              {/* 최종 집행 단추 */}
              <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                <button style={styles.btnExecute} onClick={() => handleExecutePenalty('처리완료')}>
                  ⚖️ 제재 결정 집행
                </button>
                <button style={styles.btnReject} onClick={() => handleExecutePenalty('반려')}>
                  사안 반려 처리
                </button>
              </div>

            </div>

          </div>
        </section>

      </div>
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
  filterBar: { display: 'flex', gap: '8px', marginBottom: '20px' },
  filterBtn: { padding: '8px 14px', border: '1px solid #cbd5e1', borderRadius: '20px', backgroundColor: '#fff', cursor: 'pointer', fontSize: '13px', color: '#475569', transition: 'all 0.2s' },
  filterBtnActive: { padding: '8px 14px', border: '1px solid #4f46e5', borderRadius: '20px', backgroundColor: '#4f46e5', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: '600' },
  mainLayout: { display: 'flex', gap: '24px', alignItems: 'flex-start' },
  leftSection: { flex: 1.2, backgroundColor: '#fff', borderRadius: '8px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },
  rightSection: { flex: 1, position: 'sticky' as any, top: '24px' },
  stickyCard: { backgroundColor: '#fff', borderRadius: '8px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },
  sectionTitle: { fontSize: '16px', margin: '0 0 12px 0', color: '#1e293b', fontWeight: '700' },
  table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' },
  th: { padding: '12px 8px', borderBottom: '2px solid #e2e8f0', color: '#64748b', fontWeight: '600', backgroundColor: '#f8fafc' },
  tr: { borderBottom: '1px solid #f1f5f9', cursor: 'pointer', transition: 'background-color 0.2s' },
  td: { padding: '12px 8px', verticalAlign: 'middle' },
  subText: { fontSize: '11px', color: '#94a3b8', marginTop: '2px' },
  badgeRed: { backgroundColor: '#fee2e2', color: '#b91c1c', padding: '3px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: '600' },
  badgeOrange: { backgroundColor: '#ffedd5', color: '#c2410c', padding: '3px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: '600' },
  statusWait: { backgroundColor: '#f1f5f9', color: '#475569', padding: '2px 6px', borderRadius: '4px', fontSize: '11px' },
  statusDone: { backgroundColor: '#d1fae5', color: '#065f46', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: '600' },
  evidenceBox: { backgroundColor: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #e2e8f0' },
  evidenceContent: { backgroundColor: '#fff', padding: '10px', borderRadius: '4px', border: '1px dashed #cbd5e1', fontSize: '13px', color: '#334155', fontFamily: 'monospace', minHeight: '40px', wordBreak: 'break-all' },
  formGroup: { marginBottom: '12px' },
  label: { display: 'block', fontSize: '13px', color: '#475569', marginBottom: '4px', fontWeight: '500' },
  select: { width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff', fontSize: '13px', color: '#1e293b' },
  radioLabel: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#334155', cursor: 'pointer' },
  textarea: { width: '100%', height: '70px', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', resize: 'none', fontFamily: 'inherit' },
  btnExecute: { flex: 1, padding: '10px', backgroundColor: '#dc2626', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '13px', textAlign: 'center' },
  btnReject: { padding: '10px', backgroundColor: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }
};
export default ReportManagementPage;