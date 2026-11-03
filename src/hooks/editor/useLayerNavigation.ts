import { useState } from "react";

export function useLayerNavigation(){
    const[isDetailOpen, setIsDetailOpen] = useState<string | null>(null);
    
    // 상세 뷰 열기
    const openDetail = (layerId: string | null) => {
        setIsDetailOpen(layerId);
    }

    // 상세 뷰 닫기
    const closeDetail = () => {
        setIsDetailOpen(null);
    }

    return {isDetailOpen, openDetail, closeDetail}
}