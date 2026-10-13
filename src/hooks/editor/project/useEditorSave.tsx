import { getCacheKey } from "../../../utils/editorUtils";
import { CanvasSaveRequest, editorApi, FrameSaveRequest, LayerSaveRequest } from "../../../api/editorApi";
import { CanvasState, LayerData} from "../../../type/editor";
import { useCallback, useRef, useState } from "react";
import api from "../../../lib/axios";
import Konva from "konva";

// 추후 팀원과 상의하여 외부 파일에 정의할 수도 있음
interface BulkUploadResponse {
  success: boolean;
  data: string[]; // 업로드된 파일들의 URL 배열
}

interface SaveProjectResult{
    projectId: number;
    title: string;
    isPublic: boolean;
}

export interface UseEditorProps{
    stageRef: React.RefObject<Konva.Stage | null>;
    peekLayerCanvas: (cacheKey: string) => HTMLCanvasElement | null;
}

export const useEditorSave = ({
    stageRef,
    peekLayerCanvas,
}: UseEditorProps) => {
    const [saving, setSaving] = useState(false);
    const savingRef = useRef(false);

    // ── 프로젝트 서버 저장 로직 ──────────────────────────────────────────
    const saveProject = useCallback(async (projectId: number | null, state: CanvasState, nextTitle: string, isNextPublic: boolean) 
    : Promise<SaveProjectResult | null> => {
        if (savingRef.current) return null;

        const canvas = stageRef.current;
        if (!canvas) return null;

        savingRef.current = true;
        setSaving(true); // 가드 검사가 완전히 끝난 이 시점에 확실하게 한 번만 락을 겁니다.
        
        try {
            const uploadFormData = new FormData();
            const uploadedLayerKeys: string[] = []; // : 의미 -> 타입 지정, = [] 의미 -> 빈 배열로 시작한다는 의미
            uploadFormData.append("folder", "pixel-art"); // folder : pixel-art -> R2가 folder 감지

            // 1. 스테이지 썸네일 추출 (WebP 최적화)
            const thumDataURL = canvas.toDataURL({
                mimeType: 'image/webp',
                quality: 0.7,
                pixelRatio: 1
            });
            // 첫 await 전에 모든 캐시 이미지를 캡처합니다.
            const snapshots = state.frames.flatMap(frame => frame.layers.map(layer => {
                const key = getCacheKey(frame.id, layer.id);
                const cachedCanvas = peekLayerCanvas(key);
                return { key, source: cachedCanvas
                    //? cachedCanvas.toDataURL('image/webp', 0.6)
                    ? cachedCanvas.toDataURL('image/png')
                    : layer.pixelData };
            }));
            const thumbnailBlob = await (await fetch(thumDataURL)).blob();
            uploadFormData.append('files', thumbnailBlob, 'thumbnail.webp');
            for (const { key, source } of snapshots) {
                if (!source?.trim()) continue;
                const response = await fetch(source);
                if (!response.ok) throw new Error(`레이어 이미지 읽기 실패: ${key}`);
                const blob = await response.blob();
                const extension = blob.type === 'image/webp' ? 'webp' : 'png';
                uploadFormData.append('files', blob, `layer_${key}.${extension}`);
                uploadedLayerKeys.push(key);
            }

            // 3. 파일 서버 대량(Bulk) 업로드 프로세스(이미지 저장)
            // uploadFormData 상태: pixel-art라는 경로에 thumbnail.webp과 여러 layer_${fIdx}_${layer.id}.webp가 저장됨
            const uploadRes = await api.post<BulkUploadResponse>("/api/files/upload/bulk", uploadFormData);
            
            const rawData = uploadRes.data;
            const rawList: string[] | null = Array.isArray(rawData)
            ? rawData 
            : Array.isArray(rawData?.data)
                ? rawData.data
                : null;

            // 모든 요소가 typeof === 'string'이고 공백/빈 문자열이 아닌지 확인
            const fileList: string[] | null =
            rawList && rawList.length > 0 && rawList.every((item): item is string => typeof item === "string" && item.trim().length > 0)
                ? rawList
                : null;
                
            if (!fileList || fileList.length !== uploadedLayerKeys.length + 1) {
                throw new Error('파일 업로드 응답이 유효하지 않습니다.');
            }
            
            const [uploadedThumbUrl, ...uploadedLayerUrls] = fileList;
            
            if (!uploadedThumbUrl) {
                throw new Error('썸네일 URL을 받지 못했습니다.');
            }

            const uploadedLayerUrlByKey = new Map<string, string>();
            
            uploadedLayerKeys.forEach((key, idx) => {
                const url = uploadedLayerUrls[idx];
                if (url) uploadedLayerUrlByKey.set(key, url);
            });

            // 4. 프로젝트 생성(Create) 또는 갱신(Update) 분기 조율
            let pid = projectId;
            if (!pid) {
                const res = await editorApi.createProject({
                    title: nextTitle,
                    width: state.width,
                    height: state.height,
                    isPublic: isNextPublic,
                    thumbnailUrl: uploadedThumbUrl
                });
                pid = res.data.data.projectId;
                nextTitle = res.data.data.title;
                isNextPublic = res.data.data.isPublic; 
            } else {
                const res = await editorApi.updateProject(pid, {
                    title: nextTitle,
                    width: state.width,
                    height: state.height,
                    isPublic: isNextPublic,
                    thumbnailUrl: uploadedThumbUrl,
                });
                nextTitle = res.data.data.title;
                isNextPublic = res.data.data.isPublic;
            }

            // 5. 프레임 구조 내부 레이어 상세 메타데이터 스냅샷 세이브
            const frameToSave = state.frames.map((frame): FrameSaveRequest => {
                return{
                    frameId: null, // 나중에 협업 시나리오에서 서버에서 발급된 frameId를 매핑할 수 있도록 null로 초기화
                    frameOrder: frame.frameOrder,
                    duration: frame.duration || 100, // 기본값 100ms (추후 UI에서 조정 가능)
                    layerSaveRequests: frame.layers.map((layer: LayerData): LayerSaveRequest => {
                        const layerKey = getCacheKey(frame.id, layer.id);
                        return {
                            layerId: null, // 나중에 협업 시나리오에서 서버에서 발급된 layerId를 매핑할 수 있도록 null로 초기화
                            name: layer.name,
                            layerOrder: layer.layerOrder,
                            blendMode: layer.blendMode,
                            isLocked: layer.isLocked,
                            isVisible: layer.isVisible,
                            opacity: layer.opacity,
                            fileUrl: uploadedLayerUrlByKey.get(layerKey) ?? null,
                        };
                    })
                }
            });

            if(!frameToSave || frameToSave.length === 0) {
                throw new Error('저장할 프레임 데이터가 없습니다.');
            }
            const canvasSaveRequest : CanvasSaveRequest = {
                frameSaveRequests: frameToSave
            }
            
            await editorApi.saveCanvasData(pid, canvasSaveRequest);
            
            return {
                projectId: pid,
                title: nextTitle,
                isPublic: isNextPublic,
            };
        }
        catch (error) {
            console.error("저장 중 에러 발생", error);
            throw error;
        }
        finally {
            savingRef.current = false;
            setSaving(false); // 성공하든 실패하든 무조건 락을 해제하여 다음 저장을 허용합니다.
        }
    }, [stageRef, peekLayerCanvas])

    return {
        saving,
        saveProject,
    };
};