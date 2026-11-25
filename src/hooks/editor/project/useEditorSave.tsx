import { assertResources } from '../../../utils/editorResources';
import { getCacheKey } from "../../../utils/editorUtils";
import { compositeVisibleFrame } from "../../../utils/blendMode";
import { CanvasSaveRequest, editorApi, FrameSaveRequest, LayerSaveRequest } from "../../../api/editorApi";
import { CanvasState, LayerData} from "../../../type/editor";
import { useCallback, useRef, useState } from "react";
import api from "../../../lib/axios";
import Konva from "konva";
import { fileApi } from '../../../api/fileApi';

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
    const saveProject = useCallback(async (projectId: number | null, state: CanvasState, nextTitle: string, isNextPublic: boolean, palette?: string[]) 
    : Promise<SaveProjectResult | null> => {
        if (savingRef.current) return null;

        const canvas = stageRef.current;
        if (!canvas) return null;

        savingRef.current = true;
        setSaving(true);
        
        try {
            assertResources(state);
            const layerFormData = new FormData();
            const uploadedLayerKeys: string[] = [];

            layerFormData.set("folder", "projects/images");

            // 첫 프레임을 합성하고, 합성할 수 없으면 스테이지로 썸네일을 만든다.
            const f0 = state.frames[0];
            const blended = f0 ? compositeVisibleFrame(f0.layers, f0.id, state.width, state.height, peekLayerCanvas, getCacheKey) : null;
            const thumDataURL = blended
                ? blended.toDataURL('image/webp', 0.7)
                : canvas.toDataURL({
                    mimeType: 'image/webp',
                    quality: 0.7,
                    pixelRatio: 1
                });
            // 비동기 작업 전에 모든 레이어 이미지를 캡처한다.
            const snapshots = state.frames.flatMap(frame => frame.layers.map(layer => {
                const key = getCacheKey(frame.id, layer.id);
                const cachedCanvas = peekLayerCanvas(key);
                return { key, source: cachedCanvas
                    ? cachedCanvas.toDataURL('image/png')
                    : layer.pixelData };
            }));
            const thumbnailBlob = await (await fetch(thumDataURL)).blob();

            for (const { key, source } of snapshots) {
                if (!source?.trim()) continue;
                const response = await fetch(source);
                if (!response.ok) throw new Error(`레이어 이미지 읽기 실패: ${key}`);
                const blob = await response.blob();
                const extension = blob.type === 'image/webp' ? 'webp' : 'png';
                layerFormData.append('files', blob, `layer_${key}.${extension}`);
                uploadedLayerKeys.push(key);
            }

            // 썸네일은 프로젝트 썸네일 경로로 단건 업로드한다.
            const thumbnailUrl = await fileApi.uploadImage(
                new File([thumbnailBlob], 'thumbnail.webp', { type: thumbnailBlob.type }),
                'projects/thumbnails',
            );
            if (!thumbnailUrl) {
                throw new Error('썸네일 URL을 받지 못했습니다.');
            }

            let uploadedLayerUrls: string[] = [];
            // 보낼 레이어 이미지가 있을 때만 일괄 업로드한다.
            if (uploadedLayerKeys.length > 0) {
                const { data } = await api.post<BulkUploadResponse>("/api/files/upload/bulk", layerFormData);
                const urls = Array.isArray(data) ? data : data?.data;
                if (!Array.isArray(urls) || urls.length !== uploadedLayerKeys.length ||
                    !urls.every(url => typeof url === 'string' && url.trim().length > 0)) {
                    throw new Error('파일 업로드 응답이 유효하지 않습니다.');
                }
                uploadedLayerUrls = urls;
            }

            const uploadedLayerUrlByKey = new Map<string, string>();
            
            uploadedLayerKeys.forEach((key, idx) => {
                const url = uploadedLayerUrls[idx];
                if (url) uploadedLayerUrlByKey.set(key, url);
            });

            // 저장할 내용을 담은 프레임 객체(업로드 한 URL을 레이어에 연결)
            const frameToSave = state.frames.map((frame): FrameSaveRequest => {
                return{
                    frameId: null,
                    frameOrder: frame.frameOrder,
                    duration: frame.duration || 100,
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
                frameSaveRequests: frameToSave,
                // 서버 형식(#RRGGBB·#RRGGBBAA)에 맞는 색만, 최대 256개 — 하나라도 어긋나면 저장 전체가 400이 되므로 미리 거름
                ...(palette ? { palette: palette.filter(c => /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(c)).slice(0, 256) } : {}),
                width: state.width,
                height: state.height,
            }

            // 프로젝트 생성(Create) 또는 갱신(Update) 분기 조율
            let pid = projectId;
            if (!pid) {
                const res = await editorApi.createProjectWithCanvas({
                    title: nextTitle,
                    isPublic: isNextPublic,
                    thumbnailUrl: thumbnailUrl,
                    canvasSaveRequest: canvasSaveRequest,
                });
                pid = res.data.data.projectId;
                nextTitle = res.data.data.title;
                // 응답에 공개 설정이 없으면 요청값을 유지한다.
                isNextPublic = res.data.data.isPublic ?? isNextPublic;
            } else {
                const res = await editorApi.updateProject(pid, {
                    title: nextTitle,
                    isPublic: isNextPublic,
                    thumbnailUrl: thumbnailUrl,
                });
                nextTitle = res.data.data.title;
                isNextPublic = res.data.data.isPublic ?? isNextPublic;
                await editorApi.saveCanvasData(pid, canvasSaveRequest);
            }
            
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
            setSaving(false);
        }
        
    }, [stageRef, peekLayerCanvas])

    return {
        saving,
        saveProject,
    };
};
