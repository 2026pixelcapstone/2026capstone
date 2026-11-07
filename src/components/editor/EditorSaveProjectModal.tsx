import { useEffect, useState } from 'react';
import {SaveModelData} from '../../type/editor';

// 모달에 관한 함수
export interface SaveProjectModeProps{
    isOpen: boolean; // 모달이 열려있는지 여부
    isSaveAsMode: boolean;
    onClose: () => void; // 모달을 닫는 함수
    onSave:(projectData: SaveModelData, isSaveAsMode: boolean) => void; // 최종 저장을 처리할 함수
    initialTitle?:string;
    saving?: boolean; // 저장 중 상태를 나타내는 플래그
}

export default function EditorSaveProjectModal({
    isOpen,
    isSaveAsMode,
    onClose,
    onSave,
    initialTitle = '',
    saving = false,
}: SaveProjectModeProps){
    // 모달 내부 상태 관리
    const [title, setTitle] = useState<string>(initialTitle);
    const [isSaveHovered, setIsSaveHovered] = useState(false);
    const [isCancelHovered, setIsCancelHovered] = useState(false);
    const [isSavePressed, setIsSavePressed] = useState(false);

    // 모달이 열릴 때마다 초기 상태로 리셋
    useEffect(() => {
        if (!isOpen){
            return;
        }
        setTitle(initialTitle);
        setIsSaveHovered(false);
        setIsCancelHovered(false);
        setIsSavePressed(false);
    }, [isOpen, initialTitle]);
    // 모달이 닫혀있으면 렌더링하지 않음
    if (!isOpen) return null;

    const handleSubmit = (e: React.SubmitEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!title.trim()) {
        alert('프로젝트 이름을 입력해주세요.');
        return;
        }
        onSave({ title, isPublic: false}, isSaveAsMode);
    };
    return (
        <div style={styles.overlay} onClick={onClose}>
            <div style={styles.modalBox} onClick={(e) => e.stopPropagation()}>
                <h2 style={styles.title}>
                    {isSaveAsMode ? '다른 이름으로 저장' : '프로젝트 저장하기'}
                </h2>

                <form onSubmit={handleSubmit} style={styles.form}>
                    <label style={styles.formGroup}>프로젝트 이름</label>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder='프로젝트 이름을 입력하세요'
                        style={styles.input}
                    />

                    {/* 안내 문구 영역 */}
                    <div style={styles.noticeText}>
                        🔒 저장된 프로젝트는 갤러리에 공유하기 전까지 나만 볼 수 있습니다.
                    </div>
     
                    {/* 버튼 */}
                    <div style={styles.buttonGroup}>
                        <button 
                            type="button"
                            className="transition-all duration-300 ease-in-out motion-reduce:transition-none"
                            disabled={saving}
                            onMouseEnter={() => setIsCancelHovered(true)}
                            onMouseLeave={() => setIsCancelHovered(false)}
                            onClick={() => {
                                onClose();
                            }} 
                            style={{
                                ...styles.cancelButton,
                                backgroundColor: saving ? '#9ca3af': isCancelHovered ? '#0056b3' : '#007bff',
                                color: '#ffffff',
                            }}
                        >
                            취소
                        </button>
                        <button 
                            type="submit"
                            className="transition-all duration-300 ease-in-out motion-reduce:transition-none"
                            disabled={!title.trim() || saving}
                            onMouseEnter={() => setIsSaveHovered(true)}
                            onMouseLeave={() => { 
                                setIsSaveHovered(false);
                                setIsSavePressed(false);
                            }}
                            onMouseDown={() => setIsSavePressed(true)}
                            onMouseUp={() => setIsSavePressed(false)}
                            style={{
                                ...styles.saveButton,
                                // 배경색: 비활성화면 회색, 활성화 상태에서 호버 시 오로라 그라데이션, 기본은 파랑
                                background: !title.trim()
                                    ? '#9ca3af' : saving 
                                    ? '#9ca3af'
                                    : isSaveHovered
                                    ? '#0056b3' : '#007bff',
                                
                                // 클릭 시 번쩍임(flash) 효과
                                filter: title.trim() && isSavePressed ? 'brightness(1.25)' : 'none',
                                
                                // 커서
                                 cursor: saving ? 'wait' : (!title.trim() ? 'not-allowed' : 'pointer'),
                            }}
                            >
                            {saving ? '저장 중...' : (isSaveAsMode ? '새로 저장하기' : '저장하기')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

// 스타일 객체 (기존과 동일)
const styles: { [key: string]: React.CSSProperties } = {
  overlay: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000,
  },
  modalBox: {
    backgroundColor: '#1f2937', padding: '24px', borderRadius: '8px',
    width: '400px', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
  },
  title: { margin: '0 0 20px 0', fontSize: '20px', fontWeight: 'bold', color: '#f3f4f6' },
  form: { display: 'flex', flexDirection: 'column', gap: '16px' },
  formGroup: { display: 'flex', flexDirection: 'column', gap: '8px' },
  label: { fontSize: '14px', fontWeight: '600', color: '#f3f4f6' },
  input: { padding: '10px', fontSize: '14px', borderRadius: '4px', border: '1px solid #ccc', outline: 'none' },
  noticeText: {
        fontSize: '13px',       // 입력칸보다 작은 글씨로 부가 설명임을 강조
        color: '#8b949e',       // 눈에 띄지 않는 은은한 회색 (다크 테마 기준)
        marginTop: '8px',       // 입력칸과의 간격
        display: 'flex',
        alignItems: 'center',   // 이모지와 텍스트의 수직 정렬
        gap: '4px',             // 이모지와 텍스트 사이의 여백
        lineHeight: '1.4',
    },
  buttonGroup: { display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' },
  cancelButton: { padding: '10px 16px', border: 'none', backgroundColor: '#007bff', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold'},
  saveButton: { padding: '10px 16px', border: 'none', backgroundColor: '#007bff', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' },
};