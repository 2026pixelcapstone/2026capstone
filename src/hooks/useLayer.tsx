import { LayerData } from "../constants/type";
import { useState } from "react";

export const useLayers = (initialLayer?: LayerData) => {

    const [layers, setLayers] = useState<LayerData[]>(initialLayer ? [initialLayer] : []);
    const [activeLayer, setActiveLayer] = useState<string | null>(initialLayer?.id || null);
    
    // ── 레이어 추가/삭제/선택 ───────────────────────────────────
    const addLayer = () => {
        const newLayerId = `layer-${Date.now()}`;
        const newLayer: LayerData = {
            id: newLayerId,
            name: `Layer ${layers.length + 1}`,
            layerOrder: layers.length,
            blendMode: 'NORMAL',
            isLocked: false,
            isVisible: true,
            opacity: 1.0,
            color: '#818cf8',
            pixelData: '',
        };
        setLayers([...layers, newLayer]);
        setActiveLayer(newLayerId);
    }
    const deleteLayer = (layerIdToDelete: string | null) => {
        
        if(!layerIdToDelete) return;

        if(layers.length <= 1){
            alert("최소 하나의 레이어는 존재해야 합니다");
            return;
        }
        const remainingLayers = layers.filter((layer) => layer.id !== layerIdToDelete);
        setLayers(remainingLayers);

        if(activeLayer === layerIdToDelete){
            const nextActiveId = remainingLayers[remainingLayers.length - 1].id;
            setActiveLayer(nextActiveId);
        }
    }

    const selectLayer = (layerId : string) => {
        setActiveLayer(layerId);
    }
    return {layers, activeLayer, setActiveLayer, addLayer, deleteLayer, selectLayer};
}