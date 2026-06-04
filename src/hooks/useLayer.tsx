import { createDefaultLayer } from "../constants/editor";
import { LayerData } from "../constants/type";
import { useCallback, useRef, useState } from "react";

export const useLayers = (initialLayer?: LayerData) => {

    const defaultLayer = initialLayer ?? createDefaultLayer();
    const [layers, setLayers] = useState<LayerData[]>([defaultLayer]);
    const [activeLayer, setActiveLayer] = useState<string | null>(defaultLayer.id);
    const layerCounter = useRef(1);
    
    // ── 레이어 추가/삭제/선택 ───────────────────────────────────
    const addLayer = useCallback(() => {
        const newLayerId = crypto.randomUUID(); // 또는 `layer-${++layerCounter}`
        
        layerCounter.current += 1;
        setLayers((prevLayers) => {
                const newLayer: LayerData = {
                id: newLayerId,
                name: `Layer ${layerCounter.current}`,
                layerOrder: layers.length,
                blendMode: 'NORMAL',
                isLocked: false,
                isVisible: true,
                opacity: 1.0,
                color: '#818cf8',
                pixelData: '',
            };
            return [...prevLayers, newLayer]
        });

        setActiveLayer(newLayerId);
    }, []);

    const deleteLayer = useCallback((layerIdToDelete: string | null) => {
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
    }, [layers, activeLayer]);

    const selectLayer = useCallback((layerId : string) => {
        setActiveLayer(layerId);
    }, []);

    // ── 레이어 눈 켜기/끄기 (추가해두면 UI와 바로 연결 가능!) ──
    const toggleVisibility = useCallback((layerId: string) => {
        setLayers((prevLayers) =>
            prevLayers.map((layer) =>
                layer.id === layerId ? { ...layer, isVisible: !layer.isVisible } : layer
            )
        );
    }, []);

    return {layers, activeLayer, setActiveLayer, addLayer, deleteLayer, selectLayer};
}