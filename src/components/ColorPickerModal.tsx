import { HexColorPicker } from 'react-colorful';

// 부모(기존 에디터)로부터 받아올 데이터 명세서(Props)
interface ColorPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  color: string;
  onChange: (hex: string) => void;
}

export const ColorPickerModal = ({ isOpen, onClose, color, onChange }: ColorPickerModalProps) => {
  if (!isOpen) return null; // 열려있지 않으면 아무것도 안 띄움

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      {/* 어두운 바깥 배경 클릭 시 모달 닫기 */}
      <div className="absolute inset-0" onClick={onClose} />
      
      {/* 모달 윈도우 본체 */}
      <div className="relative z-10 bg-[#161b22] p-5 rounded-xl border border-[#30363d] shadow-2xl flex flex-col gap-4 scale-105 transition-all">
        <div className="text-xs font-bold uppercase tracking-widest text-[#7d8590]">Advanced Color Picker</div>
        
        {/* 🎨 패널 드래그 시 부모의 selectPaletteColor를 호출 */}
        <HexColorPicker color={color} onChange={onChange} />
        
        <button 
          onClick={onClose}
          className="w-full py-2 text-xs font-bold text-white bg-[#2f81f7] hover:bg-[#246cd0] rounded-lg transition-all shadow-md"
        >
          Select Color
        </button>
      </div>
    </div>
  );
};