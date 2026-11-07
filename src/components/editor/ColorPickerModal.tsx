import { useEffect, useRef, useState } from 'react';
import { HexColorPicker } from 'react-colorful';

// 부모(기존 에디터)로부터 받아올 데이터 명세서(Props)
interface ColorPickerModalProps {
  isOpen: boolean;
  position: {top: number, left: number}
  rgb: {r: number, g: number, b: number};
  color: string;
  handleRgbChange: (channel: 'r' | 'g' | 'b', value: number) => void;
  onClose: () => void;
  onChange: (newColor: string) => void;
}

export function ColorPickerModal({ 
  isOpen, 
  position,
  rgb,
  color,
  handleRgbChange,
  onClose,
  onChange 
}: ColorPickerModalProps){
  const [localHex, setLocalHex] = useState(color);   // 입력창 타이핑을 부드럽게 처리하기 위한 로컬 상태
  const modalRef = useRef<HTMLDivElement>(null);   // 모달 창 자체를 가리킬 ref 생성

  // 외부 클릭 감지 이벤트 로직
  useEffect(() => {
    if (!isOpen) return; // 열려있을 때만 이벤트 등록

    const handleClickOutside = (e: MouseEvent) => {
      // 클릭한 대상(e.target)이 모달(modalRef.current)의 내부 요소가 아니라면 닫기
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    // 마우스를 누르는 순간(mousedown) 감지
    document.addEventListener('mousedown', handleClickOutside);
    
    // 클린업 함수: 컴포넌트가 언마운트되거나 닫힐 때 이벤트 제거
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);


  // 컬러피커나 RGB 슬라이더를 움직여 외부에서 색이 바뀌면 로컬 상태도 동기화
  useEffect(() => {
    setLocalHex(color);
  }, [color]);

  // 사용자가 HEX 입력창에 타이핑할 때 호출
  const handleHexInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalHex(val);

    // 정규식: #이 붙은 6자리 올바른 헥스 코드일 때만 캔버스/상태 칠하기 반영
    if (/^#[0-9a-fA-F]{6}$/.test(val)) {
      onChange(val);
    }
  };

  // ESC 키 다운 시 모달 닫기 이벤트 리스너 격리 구현
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
      // 웹 접근성을 위한 시맨틱 속성(role, aria-*) 대거 주입
      <div 
        ref={modalRef}
        className="fixed z-50 bg-surface p-5 rounded-xl border border-outline shadow-2xl flex flex-col gap-4 w-64"
        style={{
          top: `${position.top - 80}px`, 
          left: `${position.left}px`
        }}
        role="dialog"
        aria-label="Advanced Color Picker"
      >
        {/* HexColorPicker 영역 (상단 마진 약간 추가하여 여백 확보) */}
        <div className="mt-1">
          <HexColorPicker color={color} onChange={onChange} style={{ width: '100%', height: '150px' }} />
        </div>
          
        {/* RGB 슬라이더 */}
        <div className="space-y-2 px-1">
          {[
            { ch: 'R', val: rgb.r, color: '#ef4444', accent: 'accent-red-500' },
            { ch: 'G', val: rgb.g, color: '#22c55e', accent: 'accent-emerald-500' },
            { ch: 'B', val: rgb.b, color: '#3b82f6', accent: 'accent-blue-500' },
          ].map(({ ch, val, color: col, accent }) => (
            
            <div key={ch} className="flex items-center gap-2">
              {/* R, G, B 라벨 */}
              <span className="text-xs font-bold w-3 flex-shrink-0" style={{ color: col }}>{ch}</span>

              <input 
                type="range"
                min={0}
                max={255}
                value={val}
                className={`flex-1 h-1.5 cursor-pointer ${accent}`} 
                style={{
                   // 슬라이더 트랙의 기본 배경을 어둡게 설정 (필요시 커스텀 CSS 적용)
                   backgroundColor: '#3b454e', 
                   appearance: 'none',
                }}
                onChange={(e) => handleRgbChange(ch.toLowerCase() as 'r' | 'g' | 'b', Number(e.target.value))}
              />
              {/* 값 표시 */}
              <span className="text-xs font-bold w-7 text-right" style={{ color: 'var(--color-on-surface-variant)' }}>{val}</span>
            </div>
          ))}
        </div>
        
        {/* 새로 추가된 HEX 입력창 */}
        <div className="flex items-center gap-2 px-1">
          <span className="text-xs font-bold w-8 text-gray-400">HEX</span>
          <input 
            type="text"
            value={localHex}
            onChange={handleHexInputChange}
            maxLength={7}
            className="flex-1 text-sm font-bold text-center rounded-md px-2 py-1.5 outline-none transition-colors focus:ring-1 focus:ring-blue-500"
            style={{ 
              backgroundColor: '#2a343d', 
              color: '#f8fafc',
              border: '1px solid #3b454e' 
            }}
          />
        </div>

        <button 
          type="button"
          onClick={onClose}
          className="w-full py-2 text-xs font-bold text-on-primary bg-primary hover:bg-primary-pressed rounded-lg transition-all shadow-md"
          style={{ backgroundColor: '#0ea5e9' }} // 이미지와 유사한 파란색
        >
          Select Color
        </button>
      </div>
    );
};
