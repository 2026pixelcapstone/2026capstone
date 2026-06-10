import { useEffect, useState } from 'react';
import { SaveData } from '../constants/editorType';
// 모달에 관한 함수
interface SaveProjectModeProps{
    isOpen: boolean; // 모달이 열려있는지 여부
    onClose: () => void; // 모달을 닫는 함수
    onSave:(projectData: SaveData) => void; // 최종 저장을 처리할 함수
    initialTitle?:string;
    initialIsPublic?: boolean;
}

export default function EditorSaveProjectModal({
    isOpen,
    onClose,
    onSave,
    initialTitle = '',
    initialIsPublic = false,
}: SaveProjectModeProps){
    // 모달 내부 상태 관리
    const [title, setTitle] = useState<string>(initialTitle);
    const [isPublic, setIsPublic] = useState<boolean>(initialIsPublic);

    useEffect(() => {
        if (!isOpen){
            return;
        }
        setTitle(initialTitle);
        setIsPublic(initialIsPublic);
    }, [isOpen, initialTitle, initialIsPublic]);
    // 모달이 닫혀있으면 렌더링하지 않음
    if (!isOpen) return null;

    const handleSubmit = (e: React.SubmitEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!title.trim()) {
        alert('프로젝트 이름을 입력해주세요.');
        return;
        }
        // 부모에게 데이터 전달
        onSave({ title, isPublic });
    };
    return (
        <div style={styles.overlay} onClick={onClose}>
            <div style={styles.modalBox} onClick={(e) => e.stopPropagation()}>
                <h2 style={styles.title}>프로젝트 저장하기</h2>

                <form onSubmit={handleSubmit} style={styles.form}>
                    <label style={styles.formGroup}>프로젝트 이름</label>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder='프로젝트 이름을 입력하세요'
                        style={styles.input}
                    />

                    {/* 공개 설정 */}
                    <div style={styles.formGroup}>
                        <label style={styles.label}>공개 설정</label>
                        <div style={styles.radioGroup}>
                        <label style={styles.radioLabel}>
                            <input
                            type="radio"
                            name="visibility"
                            checked={!isPublic}
                            onChange={() => setIsPublic(false)}
                            />
                            🔒 비공개
                        </label>
                        <label style={styles.radioLabel}>
                            <input
                            type="radio"
                            name="visibility"
                            checked={isPublic}
                            onChange={() => setIsPublic(true)}
                            />
                            🌐 공개
                        </label>
                        </div>
                    </div>

                    {/* 버튼 */}
                    <div style={styles.buttonGroup}>
                        <button type="button" onClick={onClose} style={styles.cancelButton}>
                        취소
                        </button>
                        <button type="submit" style={styles.saveButton}>
                        저장하기
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
  radioGroup: { display: 'flex', flexDirection: 'column', gap: '8px', padding: '4px 0' },
  radioLabel: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer' },
  buttonGroup: { display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' },
  cancelButton: { padding: '10px 16px', border: '1px solid #f3f4f6', backgroundColor: '#007bff', borderRadius: '4px', cursor: 'pointer' },
  saveButton: { padding: '10px 16px', border: 'none', backgroundColor: '#007bff', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' },
};