// src/components/Dropdown.tsx
import { ReactNode, useState } from "react"

interface DropdownProps{
    isOpen: boolean;
    onClose?: () => void;
    children?: ReactNode;
}
const Dropdown = ({ isOpen, onClose, children }: DropdownProps) => {
    if (!isOpen) return null;
    return(
        <div>
            <div className="flxed inset-0 z-40 cursor-default"
                onClick={onClose}>
            </div>
            
            <div className="absolute bottom-full mb-2 right-0 w-40 bg-[#1c2128] border border-[#30363d] rounded-lg shadow-xl z-50 overflow-hidden">
                {/*기본 공통 메뉴*/}
                <button className="w-full px-4 py-2 text-left text-sm text-[#7d8590] hover:bg-[#30363d] hover:text-white flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">download</span>
                    다운로드
                </button>
        
                {/* 추가적인 버튼들 */}
                {children}
            </div>
        </div>
        
    );
};
export default Dropdown;