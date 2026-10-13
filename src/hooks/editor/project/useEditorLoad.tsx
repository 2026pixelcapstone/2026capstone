import { FrameData, LayerData, LoadedEditorProject } from "../../../type/editor";
import { editorApi } from "../../../api/editorApi";
import { useCallback } from "react";

export function useEditorLoad(){
    const loadProject = useCallback(async (projectId: number, signal: AbortSignal) : Promise<LoadedEditorProject | null> => {
        if (signal.aborted) return null;
        try {
            const res = await editorApi.getProject(projectId, { signal });
            const proj = res.data.data;
            const canvasData = proj.canvasResponse;
            // 서버에서 내려온 프레임/레이어 데이터를 순회하며 pixelData를 복원
            const restoredFrames = await Promise.all(
                (canvasData.frameResponses || []).map(async (frame: any, frameIdx: number): Promise<FrameData> => {
                const layers = frame.layerResponses || []
    
                // 레이어 이미지 URL을 fetch하여 base64로 변환 후 pixelData에 저장
                const restoredLayers: LayerData[] = await Promise.all(
                    layers.map(async (sl: any, layerIdx: number): Promise<LayerData> => {
                    let pixelData = '';
                    if (sl.fileUrl){
                        const r = await fetch(sl.fileUrl, { signal });
                        if (!r.ok) throw new Error(`레이어 이미지 복원 실패: ${sl.layerId ?? layerIdx}`)
                        
                        const blob = await r.blob()
                        pixelData = await new Promise<string>((resolve, reject) => {
                        const reader = new FileReader()
                        reader.onloadend = () => typeof reader.result === 'string'
                            ? resolve(reader.result)
                            : reject(new Error(`레이어 이미지 변환 실패: ${sl.layerId ?? layerIdx}`))
                        reader.onerror = () => reject(new Error(`레이어 이미지 변환 실패: ${sl.layerId ?? layerIdx}`))
                        reader.readAsDataURL(blob)
                        })
                    }
                    // 레이어 데이터 객체 생성
                    return{
                        id: `layer-${crypto.randomUUID().slice(0, 8)}`,
                        name: sl.name || `Layer ${layerIdx + 1}`,
                        layerOrder: sl.layerOrder ?? layerIdx,
                        blendMode: sl.blendMode || 'NORMAL',
                        isLocked: sl.isLocked || false,
                        isVisible: sl.isVisible !== false,
                        opacity: sl.opacity ?? 100,
                        color: sl.color ?? '#818cf8',
                        pixelData: pixelData,
                    }
                    })
                )
                // 복원된 레이어 데이터를 기반으로 FrameData 객체 생성
                return {
                    id: `frame-${crypto.randomUUID().slice(0, 8)}`,
                    frameOrder: frame.frameOrder ?? frameIdx,
                    duration: frame.duration,
                    layers: restoredLayers,
                }
                })
            )
            if (signal.aborted) return null;
            return {
                projectId: proj.projectId,
                title: proj.title,
                width: proj.width,
                height: proj.height,
                frames: restoredFrames,
                isPublic: proj.isPublic,
            }
        }catch (error) {
            if (signal.aborted) return null;
            console.error("프로젝트 로드 실패", error);
            throw error;
        }
    }, []);

    return { loadProject }
}
