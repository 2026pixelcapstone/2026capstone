import React, { useState } from 'react';

/*2.✅사용자 및 권한 관리
    회원 조회 ->
        사용자 조회 + 필터 + 정렬조건
        유저의 기본 정보 -> 이름, 아이디, 이메일, 가입일, 최근 로그인, 권한 정보, 
        수정일, 삭제일, 상태)
        간단한 상세 정보 -> 상세 보기 클릭 ->
        회원 상세 정보 -> 기본정보, 올린 갤러리 아트/에셋(자세한 정보는 콘텐츠 관리 담당), 
        결제 내역, 팔로잉/팔로워, IP 및 기기 추적, 세션 및 토큰 관리
*/

// ==========================================
// 1. 타입 정의 (Interfaces)
// ==========================================
interface Asset {
  id: string;
  title: string;
  type: '에셋' | '갤러리 아트';
  date: string;
}

interface Payment {
  id: string;
  date: string;
  amount: string;
  item: string;
  status: '결제 완료' | '결제 취소' | '대기중';
}

interface Social {
  following: number;
  followers: number;
}

interface Security {
  ip: string;
  device: string;
  sessionStatus: '활성화' | '만료됨';
  tokenExpires: string;
}

interface User {
  id: number;
  userId: string;
  name: string;
  email: string;
  joinDate: string;
  accountUpdate: string | null;
  accountDelete: string | null;
  role: '일반 회원' | '콘텐츠 크리에이터' | '관리자';
  lastLogin: string;
  status: '가입 대기' | '활성화' | '휴먼' | '이용정지' | '탈퇴' | '잠김';
  assets: Asset[];
  payments: Payment[];
  social: Social;
  security: Security;
}

// 서브 탭 구분을 위한 리터럴 타입
type TabType = 'content' | 'payment' | 'social' | 'security';

// ==========================================
// 2. 프로토타입용 더미 데이터
// ==========================================
const dummyUsers: User[] = [
  {
    id: 1,
    userId: 'pixel_king',
    name: '김화백',
    email: 'king@pixelhub.com',
    joinDate: '2026-01-15',
    role: '일반 회원',
    lastLogin: '2026-05-19 14:32',
    accountUpdate: null,
    accountDelete: null,
    status: '활성화',
    assets: [
      { id: 'a1', title: '사이버펑크 가로등', type: '에셋', date: '2026-04-02' },
      { id: 'a2', title: '판타지 슬라임 애니메이션', type: '갤러리 아트', date: '2026-05-10' }
    ],
    payments: [
      { id: 'p1', date: '2026-02-15', amount: '₩9,900', item: '프리미엄 1개월 구독', status: '결제 완료' },
      { id: 'p2', date: '2026-03-15', amount: '₩9,900', item: '프리미엄 1개월 구독', status: '결제 완료' }
    ],
    social: { following: 142, followers: 89 },
    security: {
      ip: '192.168.0.42',
      device: 'Windows 11 / Chrome 124.0',
      sessionStatus: '활성화',
      tokenExpires: '2026-05-20 02:30'
    }
  },
  {
    id: 2,
    userId: 'indie_dev99',
    name: '이코딩',
    email: 'dev99@gmail.com',
    joinDate: '2026-03-22',
    role: '콘텐츠 크리에이터',
    lastLogin: '2026-05-18 09:15',
    accountUpdate: null,
    accountDelete: null,
    status: '활성화',
    assets: [
      { id: 'a3', title: '8비트 던전 타일셋', type: '에셋', date: '2026-04-20' }
    ],
    payments: [],
    social: { following: 25, followers: 312 },
    security: {
      ip: '211.234.55.12',
      device: 'macOS Sonoma / Safari',
      sessionStatus: '만료됨',
      tokenExpires: '2026-05-18 10:15'
    }
  }
];

// ==========================================
// 3. 메인 컴포넌트
// ==========================================
const UserManagementPage: React.FC = () => {
  // 상태에 제네릭 타입을 명시하여 안전성 확보
  const [selectedUser, setSelectedUser] = useState<User>(dummyUsers[0]);
  const [activeTab, setActiveTab] = useState<TabType>('content');
  // 검색어 상태 관리
  const [searchTerm, setSearchTerm] = useState('');

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  }
  // 검색어에 따른 유저 필터링 로직
  const filteredUsers = dummyUsers.filter(
    (user) =>
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.userId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={styles.container}>
      {/* 상단 헤더 */}
      <header style={styles.header}>
        <h1 style={styles.headerTitle}>👤 사용자 및 권한 관리</h1>
      </header>

      {/* 메인 레이아웃: 좌측 리스트 / 우측 상세 */}
      <div style={styles.mainLayout}>
        
        {/* [좌측] 회원 목록 (회원 조회 / 기본 정보) */}
        <section style={styles.leftSection}>
          <h2 style={{ ...styles.sectionTitle, marginBottom: '12px' }}>회원 목록 ({dummyUsers.length}명)</h2>

          <div style={{ ...styles.searchWrapper, width: '100%', marginBottom: '20px' }}>
            <div style={styles.searchWrapper}>
              <input
                type='text'
                placeholder='이름 또는 아이디 검색'
                value={searchTerm}
                onChange={handleSearch}
                style={styles.searchInput}
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')}
                  style={{position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', color: '#9ca3af'}}
                >
                  ✕
                </button>
              )}
            </div>
                
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>이름 (아이디)</th>
                    <th style={styles.th}>이메일</th>
                    <th style={styles.th}>권한</th>
                    <th style={styles.th}>최근 로그인</th>
                    <th style={styles.th}>가입일</th>
                    <th style={styles.th}>수정일</th>
                    <th style={styles.th}>삭제일</th>
                    <th style={styles.th}>상태</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{...styles.td, textAlign: 'center', padding: '40px 0', color: '#6b7280'}}>
                        검색 결과와 일치하는 회원이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => (
                      <tr
                        key={user.id}
                        style={{
                          ...styles.tr,
                          backgroundColor: selectedUser.id === user.id ? '#eef2ff' : 'transparent',
                          fontWeight: selectedUser.id === user.id ? '600' : 'normal'
                        }}
                        onClick={() => setSelectedUser(user)}
                      >
                        <td style={styles.td}>
                          <span style={{color: '#4f46e5'}}>{user.name}</span>
                          <div style={styles.subText}>@{user.userId}</div>
                        </td>
                        <td style={styles.td}>{user.email}</td>
                        <td style={styles.td}>
                          <span style={user.role === '일반 회원' ? styles.badgeGray : styles.badgeIndigo}>
                            {user.role}
                          </span>
                        </td>
                        <td style={styles.td}>{user.lastLogin}</td>
                        <td style={styles.td}>{user.joinDate}</td>
                        <td style={styles.td}>{user.accountUpdate || '-'}</td>
                        <td style={styles.td}>
                          {user.accountDelete ? (
                            <span style={{color: '#dc2626'}}>{user.accountDelete}</span>
                          ) : (
                            <span style={{color: '#94a3b8'}}>-</span>
                          )}
                        </td>
                       <td style={styles.td}>
                          <span style={{
                            fontWeight: '600',
                            color: user.status === '활성화' ? '#059669' : '#94a3b8'
                          }}>
                            {user.status}
                          </span>
                      </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* [우측] 회원 상세 정보 */}
        <section style={styles.rightSection}>
          <div style={styles.stickyCard}>
            <h2 style={styles.sectionTitle}>회원 상세 정보</h2>
            
            {/* 미니 프로필 카드 */}
            <div style={styles.profileSummary}>
              <div style={styles.avatar}>{selectedUser.name[0]}</div>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px' }}>{selectedUser.name} ({selectedUser.userId})</h3>
                <p style={{ margin: '4px 0 0', color: '#666', fontSize: '14px' }}>{selectedUser.email}</p>
              </div>
            </div>

            {/* 내부 상세 탭 메뉴 */}
            <div style={styles.tabMenu}>
              <button 
                style={activeTab === 'content' ? styles.activeTabBtn : styles.tabBtn} 
                onClick={() => setActiveTab('content')}
              >
                콘텐츠 ({selectedUser.assets.length})
              </button>
              <button 
                style={activeTab === 'payment' ? styles.activeTabBtn : styles.tabBtn} 
                onClick={() => setActiveTab('payment')}
              >
                결제 내역 ({selectedUser.payments.length})
              </button>
              <button 
                style={activeTab === 'social' ? styles.activeTabBtn : styles.tabBtn} 
                onClick={() => setActiveTab('social')}
              >
                관계 (팔로우)
              </button>
              <button 
                style={activeTab === 'security' ? styles.activeTabBtn : styles.tabBtn} 
                onClick={() => setActiveTab('security')}
              >
                보안 및 세션
              </button>
            </div>

            {/* 탭 콘텐츠 영역 */}
            <div style={styles.tabContent}>
              
              {/* 1. 올린 갤러리 아트 / 에셋 */}
              {activeTab === 'content' && (
                <div>
                  <h4 style={styles.tabContentTitle}>올린 갤러리 아트 / 에셋 담당</h4>
                  {selectedUser.assets.length === 0 ? (
                    <p style={styles.emptyText}>등록된 콘텐츠가 없습니다.</p>
                  ) : (
                    <ul style={styles.list}>
                      {selectedUser.assets.map(asset => (
                        <li key={asset.id} style={styles.listItem}>
                          <div>
                            <span style={asset.type === '에셋' ? styles.badgeGreen : styles.badgeOrange}>
                              {asset.type}
                            </span>
                            <span style={{ marginLeft: '8px' }}>{asset.title}</span>
                          </div>
                          <span style={styles.subText}>{asset.date}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* 2. 결제 내역 */}
              {activeTab === 'payment' && (
                <div>
                  <h4 style={styles.tabContentTitle}>결제 히스토리</h4>
                  {selectedUser.payments.length === 0 ? (
                    <p style={styles.emptyText}>결제 내역이 존재하지 않습니다.</p>
                  ) : (
                    <ul style={styles.list}>
                      {selectedUser.payments.map(pay => (
                        <li key={pay.id} style={styles.listItem}>
                          <div>
                            <div style={{ fontWeight: '500' }}>{pay.item}</div>
                            <div style={styles.subText}>{pay.date} • {pay.status}</div>
                          </div>
                          <span style={{ color: '#059669', fontWeight: '600' }}>{pay.amount}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* 3. 팔로잉 / 팔로워 */}
              {activeTab === 'social' && (
                <div>
                  <h4 style={styles.tabContentTitle}>네트워크 정보</h4>
                  <div style={styles.grid}>
                    <div style={styles.gridCard}>
                      <div style={styles.gridCardLabel}>팔로잉</div>
                      <div style={styles.gridCardValue}>{selectedUser.social.following}명</div>
                    </div>
                    <div style={styles.gridCard}>
                      <div style={styles.gridCardLabel}>팔로워</div>
                      <div style={styles.gridCardValue}>{selectedUser.social.followers}명</div>
                    </div>
                  </div>
                </div>
              )}

              {/* 4. IP/기기 추적 및 세션/토큰 관리 */}
              {activeTab === 'security' && (
                <div>
                  <h4 style={styles.tabContentTitle}>접속 기기 및 세션 정보</h4>
                  <div style={styles.infoRow}>
                    <span style={styles.infoLabel}>최근 접속 IP</span>
                    <span style={styles.infoValue}>{selectedUser.security.ip}</span>
                  </div>
                  <div style={styles.infoRow}>
                    <span style={styles.infoLabel}>접속 기기 / 브라우저</span>
                    <span style={styles.infoValue}>{selectedUser.security.device}</span>
                  </div>
                  <div style={styles.infoRow}>
                    <span style={styles.infoLabel}>현재 세션 상태</span>
                    <span style={{
                      ...styles.infoValue, 
                      color: selectedUser.security.sessionStatus === '활성화' ? '#059669' : '#dc2626',
                      fontWeight: '600'
                    }}>
                      {selectedUser.security.sessionStatus}
                    </span>
                  </div>
                  <div style={styles.infoRow}>
                    <span style={styles.infoLabel}>액세스 토큰 만료</span>
                    <span style={styles.infoValue}>{selectedUser.security.tokenExpires}</span>
                  </div>
                  
                  <button style={styles.dangerBtn}>현재 세션 강제 로그아웃</button>
                </div>
              )}

            </div>
          </div>
        </section>

      </div>
    </div>
  );
};

// ==========================================
// 4. 인라인 스타일 타입 선언 및 객체
// ==========================================
const styles: { [key: string]: React.CSSProperties } = {
  container: { padding: '24px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', color: '#333', backgroundColor: '#f8fafc', minHeight: '100vh' },
  header: { marginBottom: '24px', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' },
  headerTitle: { margin: '0 0 8px 0', fontSize: '24px', color: '#1e293b' },
  headerSub: { margin: 0, color: '#64748b', fontSize: '14px' },
  mainLayout: { display: 'flex', gap: '24px', alignItems: 'flex-start' },
  leftSection: { flex: 1.5, backgroundColor: '#fff', borderRadius: '8px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },
  rightSection: { flex: 1, position: 'sticky' as any, top: '24px' }, // TSX 환경에서 sticky 호환성 우회
  stickyCard: { backgroundColor: '#fff', borderRadius: '8px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },
  sectionTitle: { fontSize: '18px', margin: '0 0 16px 0', color: '#1e293b' },
  tableWrapper: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' },
  th: { padding: '12px', borderBottom: '2px solid #e2e8f0', color: '#64748b', fontWeight: '600' },
  tr: { borderBottom: '1px solid #f1f5f9', cursor: 'pointer', transition: 'background-color 0.2s' },
  td: { padding: '12px', verticalAlign: 'middle' },
  subText: { fontSize: '12px', color: '#94a3b8', marginTop: '2px' },
  badgeGray: { backgroundColor: '#f1f5f9', color: '#475569', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' },
  badgeIndigo: { backgroundColor: '#e0e7ff', color: '#4338ca', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' },
  badgeGreen: { backgroundColor: '#d1fae5', color: '#065f46', padding: '2px 6px', borderRadius: '4px', fontSize: '11px' },
  badgeOrange: { backgroundColor: '#ffedd5', color: '#9a3412', padding: '2px 6px', borderRadius: '4px', fontSize: '11px' },
  profileSummary: { display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '6px', marginBottom: '16px' },
  avatar: { width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#4f46e5', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 'bold' },
  tabMenu: { display: 'flex', borderBottom: '1px solid #e2e8f0', marginBottom: '16px', gap: '4px' },
  tabBtn: { padding: '8px 12px', border: 'none', background: 'none', cursor: 'pointer', color: '#64748b', fontSize: '14px', borderBottom: '2px solid transparent' },
  activeTabBtn: { padding: '8px 12px', border: 'none', background: 'none', cursor: 'pointer', color: '#4f46e5', fontSize: '14px', borderBottom: '2px solid #4f46e5', fontWeight: '600' },
  tabContent: { minHeight: '200px' },
  tabContentTitle: { fontSize: '14px', color: '#64748b', margin: '0 0 12px 0' },
  emptyText: { color: '#94a3b8', fontSize: '14px', textAlign: 'center', padding: '32px 0' },
  list: { listStyle: 'none', padding: 0, margin: 0 },
  listItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f1f5f9', fontSize: '14px' },
  grid: { display: 'flex', gap: '12px' },
  gridCard: { flex: 1, backgroundColor: '#f8fafc', padding: '16px', borderRadius: '6px', textAlign: 'center' },
  gridCardLabel: { fontSize: '12px', color: '#64748b', marginBottom: '4px' },
  gridCardValue: { fontSize: '18px', fontWeight: '600', color: '#1e293b' },
  infoRow: { display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9', fontSize: '14px' },
  infoLabel: { color: '#64748b' },
  infoValue: { color: '#1e293b' },
  dangerBtn: { width: '100%', marginTop: '16px', padding: '10px', backgroundColor: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' },
  searchWrapper: {
    position: 'relative' as const,
    width: '260px',
  },
  searchInput: {
    width: '100%',
    padding: '10px 36px 10px 12px', // [✕] 버튼 자리를 위해 오른쪽 패딩을 조금 더 줌
    borderRadius: '6px',
    border: '1px solid #d1d5db',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box' as const,
  }
};
export default UserManagementPage;