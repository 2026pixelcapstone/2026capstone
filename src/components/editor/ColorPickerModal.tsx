import { useEffect } from 'react';
import { HexColorPicker } from 'react-colorful';

// 부모(기존 에디터)로부터 받아올 데이터 명세서(Props)
interface ColorPickerModalProps {
  isOpen: boolean;
  rgb: {r: number, g: number, b: number};
  color: string;
  handleRgbChange: (channel: 'r' | 'g' | 'b', value: number) => void;
  onClose: () => void;
  onChange: (hex: string) => void;
}

export function ColorPickerModal({ 
  isOpen, 
  rgb,
  color,
  handleRgbChange,
  onClose,
  onChange 
}: ColorPickerModalProps){
  
  if (!isOpen) return null; // 열려있지 않으면 아무것도 안 띄움
  
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
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-label="Advanced Color Picker"
      >
        {/* 바깥 배경 클릭 시 닫기 */}
        <div className="absolute inset-0" onClick={onClose} />
        
        {/* 모달 윈도우 본체 */}
        <div className="relative z-10 bg-surface p-5 rounded-xl border border-outline shadow-2xl flex flex-col gap-4 scale-105 transition-all">
          <div className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Advanced Color Picker</div>
          
          <HexColorPicker color={color} onChange={onChange} />
          
          {/* RGB 슬라이더 */}
          <div className="space-y-2 px-1">
            {[
              { ch: 'R', val: rgb.r, color: '#ef4444', accent: 'accent-red-500' },
              { ch: 'G', val: rgb.g, color: '#22c55e', accent: 'accent-emerald-500' },
              { ch: 'B', val: rgb.b, color: '#3b82f6', accent: 'accent-blue-500' },
            ].map(({ ch, val, color: col, accent }) => (
              
              <div key={ch} className="flex items-center gap-2">
                <span className="text-xs font-bold w-3 flex-shrink-0" style={{ color: col }}>{ch}</span>

                <input 
                  type="range"
                  min={0}
                  max={255}
                  value={val}
                  className={`flex-1 h-1.5 cursor-pointer ${accent}`} 
                  onChange={(e) => handleRgbChange(ch.toLowerCase() as 'r' | 'g' | 'b', Number(e.target.value))}
                  />
                <span className="text-xs font-bold w-7 text-right" style={{ color: 'var(--color-on-surface-variant)' }}>{val}</span>
              </div>
            ))}
          </div>
          
          <button 
            type="button"
            onClick={onClose}
            className="w-full py-2 text-xs font-bold text-on-primary bg-primary hover:bg-primary-pressed rounded-lg transition-all shadow-md"
          >
            Select Color
          </button>
        </div>
      </div>
    );
};