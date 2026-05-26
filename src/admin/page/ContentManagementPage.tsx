import { useState } from "react";

// ==========================================
// 1. 타입 정의 (Interfaces)
// ==========================================
interface ContentItem {
  id: string;
  title: string;
  creator: string;
  type: '갤러리' | '에셋';
  isVisible: boolean;      // 공개 여부
  isFeatured: boolean;     // 추천 작품 여부
  isBlinded: boolean;      // 블라인드 여부
  createdAt: string;
}

interface CategoryTagItem {
  id: string;
  name: string;
  type: '카테고리' | '태그';
  sortOrder: number;       // 순서 (sort_order)
  isFeatured: boolean;     // 추천 등록 여부
}

type MainTabType = 'posts' | 'categories';
type PostFilterType = 'all' | 'blinded';

// ==========================================
// 2. 프로토타입용 더미 데이터
// ==========================================
const initialContents: ContentItem[] = [
  { id: 'c1', title: '네온사인 가득한 미래 도시 픽셀 아트', creator: '김화백', type: '갤러리', isVisible: true, isFeatured: true, isBlinded: false, createdAt: '2026-05-20' },
  { id: 'c2', title: '로우폴리 던전 보스 몬스터 3D 모델링', creator: '이코딩', type: '에셋', isVisible: true, isFeatured: false, isBlinded: false, createdAt: '2026-05-22' },
  { id: 'c3', title: '[블라인드] 불법 도용된 상업용 UI 팩', creator: '도둑고양이', type: '에셋', isVisible: false, isFeatured: false, isBlinded: true, createdAt: '2026-05-18' },
  { id: 'c4', title: '평화로운 시골 마을 배경음악 BGM', creator: '음악대장', type: '에셋', isVisible: false, isFeatured: false, isBlinded: false, createdAt: '2026-05-24' },
  { id: 'c5', title: '[블라인드] 부적절한 언어가 포함된 일러스트', creator: '무법자', type: '갤러리', isVisible: false, isFeatured: false, isBlinded: true, createdAt: '2026-05-15' },
];

const initialCategoriesAndTags: CategoryTagItem[] = [
  { id: 'ct1', name: '픽셀 아트 (Pixel)', type: '카테고리', sortOrder: 1, isFeatured: true },
  { id: 'ct2', name: '3D 모델링 (3D Model)', type: '카테고리', sortOrder: 2, isFeatured: true },
  { id: 'ct3', name: '사운드 이펙트 (SFX)', type: '카테고리', sortOrder: 3, isFeatured: false },
  { id: 'ct4', name: '#사이버펑크', type: '태그', sortOrder: 1, isFeatured: true },
  { id: 'ct5', name: '#레트로_8비트', type: '태그', sortOrder: 2, isFeatured: false },
  { id: 'ct6', name: '#판타지', type: '태그', sortOrder: 3, isFeatured: true },
];

// ==========================================
// 3. 메인 컴포넌트
// ==========================================
const ContentManagementPage: React.FC = () => {
    // 상태 관리 (State)
    const [activeMainTab, setActiveMainTab] = useState<MainTabType>('posts');
    const [postFilter, setPostFilter] = useState<PostFilterType>('all');
    const [contents, setContents] = useState<ContentItem[]>(initialContents);
    const [metaItems, setMetaItems] = useState<CategoryTagItem[]>(initialCategoriesAndTags);

    const [searchQuery, setSearchQuery] = useState<string>('');

    // ----------------------------------------
    // 기능 함수군 (가상 돔 리렌더링 유발 타겟들)
    // ----------------------------------------
    
    // [게시물] 공개 여부 토글
    const toggleVisibility = (id: string) => {
        setContents(prev => prev.map(item => 
        item.id === id ? { ...item, isVisible: !item.isVisible } : item
        ));
    };

    // [게시물] 추천 작품 토글
    const toggleFeaturedPost = (id: string) => {
        setContents(prev => prev.map(item => 
        item.id === id ? { ...item, isFeatured: !item.isFeatured } : item
        ));
    };

    // [게시물] 블라인드 해제/처리 단독 제어
    const toggleBlind = (id: string) => {
        setContents(prev => prev.map(item => 
        item.id === id ? { ...item, isBlinded: !item.isBlinded, isVisible: item.isBlinded } : item
        ));
    };

    // [카테고리/태그] 추천 등록 토글
    const toggleFeaturedMeta = (id: string) => {
        setMetaItems(prev => prev.map(item => 
        item.id === id ? { ...item, isFeatured: !item.isFeatured } : item
        ));
    };

    // [카테고리/태그] 순서 조정 (sort_order) 함수
    const moveOrder = (id: string, direction: 'up' | 'down', type: '카테고리' | '태그') => {
        // 같은 타입끼리만 묶어서 순서를 바꿉니다.
        const filtered = metaItems.filter(item => item.type === type).sort((a, b) => a.sortOrder - b.sortOrder);
        const index = filtered.findIndex(item => item.id === id);
        
        if (direction === 'up' && index === 0) return; // 맨 위면 이동 불가
        if (direction === 'down' && index === filtered.length - 1) return; // 맨 아래면 이동 불가

        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        
        // 두 아이템의 sortOrder를 교체
        const currentItem = filtered[index];
        const targetItem = filtered[targetIndex];
        
        const tempOrder = currentItem.sortOrder;
        currentItem.sortOrder = targetItem.sortOrder;
        targetItem.sortOrder = tempOrder;

        // 전체 상태 갱신하여 리렌더링 유발
        setMetaItems([...metaItems]);
    };

    // 필터링된 게시물 목록 계산
    const filteredContents = contents.filter(item => {
        if (postFilter === 'blinded') return item.isBlinded;
        if (searchQuery.trim() !== ''){
            const query = searchQuery.toLowerCase();
            const matchTitle = item.title.toLowerCase().includes(query);
            const matchCreator = item.creator.toLowerCase().includes(query);
            return matchTitle || matchCreator;
        }
        return true; // 'all'인 경우 전체 노출 (블라인드 포함)
    });

    return (
        <div style={styles.container}>
            {/* 상단 헤더 */}
            <header style={styles.header}>
                <div style={styles.headerTopFlex}>
                    <div>
                        <h1 style={styles.headerTitle}>🎬 콘텐츠 관리 시스템</h1>
                        <p style={styles.headerSub}>게시물(갤러리/에셋)의 상태 제어 및 카테고리/태그 메타데이터 노출 순서를 정렬합니다.</p>
                    </div>

                    <div style={styles.searchWrapper}>
                        <span style={styles.searchIcon}>🔍</span>
                        <input
                            type="text"
                            placeholder="콘텐츠 타이틀 또는 창작자 검색" // 미리보기 텍스트
                            style={styles.searchInput} 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                        <button style={styles.searchClearBtn} onClick={() => setSearchQuery('')}>✕</button>
                    )}
                    </div>
                </div>
            </header>

        {/* 대메뉴 탭 메뉴 */}
        <div style={styles.mainTabMenu}>
            <button 
            style={activeMainTab === 'posts' ? styles.activeMainTabBtn : styles.mainTabBtn}
            onClick={() => setActiveMainTab('posts')}
            >
            📂 통합 게시물 관리 (갤러리 / 에셋)
            </button>
            <button 
            style={activeMainTab === 'categories' ? styles.activeMainTabBtn : styles.mainTabBtn}
            onClick={() => setActiveMainTab('categories')}
            >
            🏷️ 카테고리 / 태그 관리
            </button>
        </div>

        {/* ======================================================= */}
        {/* 탭 1: 통합 게시물 관리 영역                             */}
        {/* ======================================================= */}
        {activeMainTab === 'posts' && (
            <section style={styles.sectionCard}>
            {/* 소필터 (전체조회 vs 블라인드조회) */}
            <div style={styles.filterBar}>
                <button 
                style={postFilter === 'all' ? styles.filterBtnActive : styles.filterBtn}
                onClick={() => setPostFilter('all')}
                >
                전체 작품 보기 ({contents.length})
                </button>
                <button 
                style={postFilter === 'blinded' ? styles.filterBtnActiveBlinded : styles.filterBtn}
                onClick={() => setPostFilter('blinded')}
                >
                🚨 블라인드 처리된 게시물 ({contents.filter(c => c.isBlinded).length})
                </button>
            </div>

            <table style={styles.table}>
                <thead>
                <tr>
                    <th style={styles.th}>구분</th>
                    <th style={styles.th}>콘텐츠 타이틀 / 창작자</th>
                    <th style={styles.th}>등록일</th>
                    <th style={styles.th}>공개 여부 조정</th>
                    <th style={styles.th}>추천 작품</th>
                    <th style={styles.th}>관리 상태</th>
                </tr>
                </thead>
                <tbody>
                {filteredContents.map(item => (
                    <tr key={item.id} style={{...styles.tr, opacity: item.isBlinded ? 0.6 : 1}}>
                    <td style={styles.td}>
                        <span style={item.type === '에셋' ? styles.badgeGreen : styles.badgeOrange}>
                        {item.type}
                        </span>
                    </td>
                    <td style={styles.td}>
                        <div style={{ fontWeight: '600', color: item.isBlinded ? '#dc2626' : '#1e293b' }}>
                        {item.title}
                        </div>
                        <div style={styles.subText}>by {item.creator}</div>
                    </td>
                    <td style={styles.td}>{item.createdAt}</td>
                    <td style={styles.td}>
                        <button 
                        disabled={item.isBlinded}
                        style={item.isVisible ? styles.actionBtnSuccess : styles.actionBtnGray}
                        onClick={() => toggleVisibility(item.id)}
                        >
                        {item.isVisible ? '공개 중' : '비공개'}
                        </button>
                    </td>
                    <td style={styles.td}>
                        <button 
                        disabled={item.isBlinded}
                        style={item.isFeatured ? styles.actionBtnWarning : styles.actionBtnGray}
                        onClick={() => toggleFeaturedPost(item.id)}
                        >
                        {item.isFeatured ? '★ 추천됨' : '일반'}
                        </button>
                    </td>
                    <td style={styles.td}>
                        <button 
                        style={item.isBlinded ? styles.dangerBtnActive : styles.dangerBtn}
                        onClick={() => toggleBlind(item.id)}
                        >
                        {item.isBlinded ? '블라인드 해제' : '블라인드 처리'}
                        </button>
                    </td>
                    </tr>
                ))}
                </tbody>
            </table>
            </section>
        )}

        {/* ======================================================= */}
        {/* 탭 2: 카테고리 / 태그 관리 영역                          */}
        {/* ======================================================= */}
        {activeMainTab === 'categories' && (
            <div style={{ display: 'flex', gap: '24px' }}>
            
            {/* [좌측] 카테고리 섹션 */}
            <section style={{ ...styles.sectionCard, flex: 1 }}>
                <h3 style={styles.sectionTitle}>📁 카테고리 순서 및 추천 관리</h3>
                <table style={styles.table}>
                <thead>
                    <tr>
                    <th style={styles.th}>노출 순서</th>
                    <th style={styles.th}>카테고리명</th>
                    <th style={styles.th}>추천 등록</th>
                    <th style={styles.th}>순서 조정</th>
                    </tr>
                </thead>
                <tbody>
                    {metaItems.filter(i => i.type === '카테고리').sort((a,b)=>a.sortOrder-b.sortOrder).map(cat => (
                    <tr key={cat.id} style={styles.tr}>
                        <td style={{...styles.td, fontWeight: 'bold', color: '#4f46e5'}}>{cat.sortOrder}위</td>
                        <td style={styles.td}>{cat.name}</td>
                        <td style={styles.td}>
                        <button 
                            style={cat.isFeatured ? styles.actionBtnWarning : styles.actionBtnGray}
                            onClick={() => toggleFeaturedMeta(cat.id)}
                        >
                            {cat.isFeatured ? '추천 카테고리' : '일반'}
                        </button>
                        </td>
                        <td style={styles.td}>
                        <button style={styles.orderBtn} onClick={() => moveOrder(cat.id, 'up', '카테고리')}>▲</button>
                        <button style={styles.orderBtn} onClick={() => moveOrder(cat.id, 'down', '카테고리')}>▼</button>
                        </td>
                    </tr>
                    ))}
                </tbody>
                </table>
            </section>

            {/* [우측] 태그 섹션 */}
            <section style={{ ...styles.sectionCard, flex: 1 }}>
                <h3 style={styles.sectionTitle}>#️⃣ 태그 노출 및 추천 관리</h3>
                <table style={styles.table}>
                <thead>
                    <tr>
                    <th style={styles.th}>노출 순서</th>
                    <th style={styles.th}>태그명</th>
                    <th style={styles.th}>추천 등록</th>
                    <th style={styles.th}>순서 조정</th>
                    </tr>
                </thead>
                <tbody>
                    {metaItems.filter(i => i.type === '태그').sort((a,b)=>a.sortOrder-b.sortOrder).map(tag => (
                    <tr key={tag.id} style={styles.tr}>
                        <td style={{...styles.td, fontWeight: 'bold', color: '#059669'}}>{tag.sortOrder}위</td>
                        <td style={styles.td}><code style={styles.code}>{tag.name}</code></td>
                        <td style={styles.td}>
                        <button 
                            style={tag.isFeatured ? styles.actionBtnWarning : styles.actionBtnGray}
                            onClick={() => toggleFeaturedMeta(tag.id)}
                        >
                            {tag.isFeatured ? '추천 태그' : '일반'}
                        </button>
                        </td>
                        <td style={styles.td}>
                        <button style={styles.orderBtn} onClick={() => moveOrder(tag.id, 'up', '태그')}>▲</button>
                        <button style={styles.orderBtn} onClick={() => moveOrder(tag.id, 'down', '태그')}>▼</button>
                        </td>
                    </tr>
                    ))}
                </tbody>
                </table>
            </section>

            </div>
        )}
        </div>
    );
};

// ==========================================
// 4. 인라인 스타일 가이드 객체
// ==========================================
const styles: { [key: string]: React.CSSProperties } = {
    container: { padding: '24px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', color: '#333', backgroundColor: '#f8fafc', minHeight: '100vh' },
    header: { marginBottom: '24px', borderBottom: '1px solid #e2e8f0', paddingBottom: '20px' },
    headerTitle: { margin: '0 0 8px 0', fontSize: '24px', color: '#1e293b' },
    headerSub: { margin: 0, color: '#64748b', fontSize: '14px' },
    mainTabMenu: { display: 'flex', gap: '12px', marginBottom: '20px', borderBottom: '2px solid #e2e8f0' },
    mainTabBtn: { padding: '12px 20px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '16px', color: '#64748b', fontWeight: '500', borderBottom: '3px solid transparent' },
    activeMainTabBtn: { padding: '12px 20px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '16px', color: '#4f46e5', fontWeight: 'bold', borderBottom: '3px solid #4f46e5' },
    sectionCard: { backgroundColor: '#fff', borderRadius: '8px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '24px' },
    sectionTitle: { fontSize: '16px', margin: '0 0 16px 0', color: '#1e293b' },
    filterBar: { display: 'flex', gap: '8px', marginBottom: '16px' },
    filterBtn: { padding: '8px 14px', border: '1px solid #e2e8f0', borderRadius: '6px', backgroundColor: '#fff', cursor: 'pointer', fontSize: '13px', color: '#64748b' },
    filterBtnActive: { padding: '8px 14px', border: '1px solid #4f46e5', borderRadius: '6px', backgroundColor: '#eef2ff', color: '#4f46e5', cursor: 'pointer', fontSize: '13px', fontWeight: '600' },
    filterBtnActiveBlinded: { padding: '8px 14px', border: '1px solid #dc2626', borderRadius: '6px', backgroundColor: '#fee2e2', color: '#dc2626', cursor: 'pointer', fontSize: '13px', fontWeight: '600' },
    table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' },
    th: { padding: '12px', borderBottom: '2px solid #e2e8f0', color: '#64748b', fontWeight: '600', backgroundColor: '#f8fafc' },
    tr: { borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.2s' },
    td: { padding: '12px', verticalAlign: 'middle' },
    subText: { fontSize: '12px', color: '#94a3b8', marginTop: '2px' },
    badgeGreen: { backgroundColor: '#d1fae5', color: '#065f46', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '600' },
    badgeOrange: { backgroundColor: '#ffedd5', color: '#9a3412', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '600' },
    actionBtnSuccess: { padding: '6px 12px', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' },
    actionBtnWarning: { padding: '6px 12px', backgroundColor: '#f59e0b', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' },
    actionBtnGray: { padding: '6px 12px', backgroundColor: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' },
    dangerBtn: { padding: '6px 12px', backgroundColor: '#fff', color: '#dc2626', border: '1px solid #fee2e2', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' },
    dangerBtnActive: { padding: '6px 12px', backgroundColor: '#dc2626', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' },
    orderBtn: { padding: '4px 8px', backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '4px', cursor: 'pointer', marginRight: '4px', fontSize: '11px' },
    code: { fontFamily: 'monospace', backgroundColor: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', color: '#059669', fontSize: '13px' },
    
    headerTopFlex: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px', flexWrap: 'wrap' },
    searchWrapper: { position: 'relative', display: 'flex', alignItems: 'center', minWidth: '320px' },
    searchIcon: { position: 'absolute', left: '12px', color: '#94a3b8', fontSize: '14px', pointerEvents: 'none' },
    searchInput: { width: '100%', padding: '10px 36px 10px 36px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', color: '#1e293b', outline: 'none', transition: 'border-color 0.2s', backgroundColor: '#fff' },
    searchClearBtn: { position: 'absolute', right: '12px', border: 'none', background: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '12px', padding: '4px' },

};
export default ContentManagementPage;