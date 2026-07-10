import { getCacheKey } from "../../utils/editorUtils";
import { editorApi, LayerSaveRequest } from "../../api/editorApi";
import { LayerData, SaveData, useEditorProps } from "../../constants/editorType";
import { toast } from "../../store/toastStore";
import { useCallback, useState } from "react";
import api from "../../lib/axios";

export const useEditor = ({
    stageRef,
    layerCanvasRefs,
    canvasW,
    canvasH,
    state,
    isLoggedIn,
    setUnsaved,
    setSearchParams,
}: useEditorProps) => {
    const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
    const [projectId, setProjectId]       = useState<number | null>(null);
    const [projectTitle, setProjectTitle] = useState('Untitled Project');
    const [editingTitle, setEditingTitle] = useState(false);
    const [saving, setSaving]              = useState(false);

    // ── 프로젝트 서버 저장 로직 ──────────────────────────────────────────
    const handleSave = useCallback(async (saveData?: SaveData) => {
        if (!isLoggedIn) { 
            toast.error('로그인이 필요합니다.'); 
            return; 
        }
        if (saving) return;

        const canvas = stageRef.current;
        if (!canvas) return;

        const nextTitle = saveData?.title.trim() || projectTitle.trim();
        const nextIsPublic = saveData?.isPublic || false;

        if (!nextTitle) {
            toast.error('프로젝트 이름을 입력해주세요');
            return; // 여기서는 아직 setSaving(true) 전이므로 안전하게 탈출합니다.
        }


        setSaving(true); //  가드 검사가 완전히 끝난 이 시점에 확실하게 한 번만 락을 겁니다.
        
        try {
            const uploadFormData = new FormData();
            const uploadedLayerKeys: string[] = [];
            uploadFormData.append("folder", "pixel-art");

            // 1. 스테이지 썸네일 추출 (WebP 최적화)
            const thumDataURL = canvas.toDataURL({
                mimeType: 'image/webp',
                quality: 0.7,
                pixelRatio: 1
            });
            const thumbResponse = await fetch(thumDataURL);
            const thumbnailBlob = await thumbResponse.blob();
            uploadFormData.append('files', thumbnailBlob, 'thumbnail.webp');

            // 2. 각 프레임의 레이어 순회 및 블롭 바이너리 축적
            for (const [fIdx, frame] of state.frames.entries()) {
                for (const layer of frame.layers) {
                    const layerKey = getCacheKey(fIdx, layer.id);
                    const layerCanvas = layerCanvasRefs.current[layerKey];
                    if (layerCanvas) {
                        const layerDataURL = layerCanvas.toDataURL('image/webp', 0.6);
                        const layerResponse = await fetch(layerDataURL);
                        const layerBlob = await layerResponse.blob();

                        uploadFormData.append('files', layerBlob, `layer_${fIdx}_${layer.id}.webp`);
                        uploadedLayerKeys.push(layerKey);
                    }
                }
            }

            // 3. 파일 서버 대량(Bulk) 업로드 프로세스
            const uploadRes = await api.post<{ data: string[] }>("/api/files/upload/bulk", uploadFormData);
            

            // 봇의 지적 반영: API 응답 구조 정규화 및 방어적 유효성 검증 추가
            const responseData = uploadRes.data as { data?: string[] } | string[];
            const fileList = Array.isArray(responseData) 
                ? responseData 
                : (responseData?.data && Array.isArray(responseData.data) ? responseData.data : null);
            
            if (!fileList || fileList.length === 0) {
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
                    width: canvasW,
                    height: canvasH,
                    isPublic: nextIsPublic,
                    thumbnailUrl: uploadedThumbUrl
                });
                pid = res.data.data.projectId;
                setProjectId(pid);
                setSearchParams({ projectId: String(pid) }, { replace: true });
            } else {
                await editorApi.updateProject(pid, {
                    title: nextTitle,
                    isPublic: nextIsPublic,
                    thumbnailUrl: uploadedThumbUrl,
                });
            }

            // 5. 프레임 구조 내부 레이어 상세 메타데이터 스냅샷 세이브
            const layersToSave: LayerSaveRequest[] = state.frames.flatMap((frame, fIdx) =>
                frame.layers.map((layer: LayerData): LayerSaveRequest => {
                    const cleanId = String(layer.id).trim();
                    // 임시 클라이언트용 ID('layer-xxxx') 분기 필터링 고도화
                    const isNewLayer = cleanId.startsWith('layer-') || cleanId === 'null' || cleanId === 'undefined' || !cleanId;
                    const layerKey = getCacheKey(fIdx, layer.id);

                    return {
                        layerId: isNewLayer ? null : Number(cleanId),
                        name: layer.name,
                        layerOrder: layer.layerOrder,
                        blendMode: layer.blendMode,
                        isLocked: layer.isLocked,
                        isVisible: layer.isVisible,
                        opacity: layer.opacity,
                        fileUrl: uploadedLayerUrlByKey.get(layerKey) ?? null,
                        pixelData: "" // 픽셀 처리는 이미지 파일 URL로 영구 보존하므로 공백 처리 유지
                    };
                })
            );

            await editorApi.saveLayers(pid, layersToSave);

            setUnsaved(false);
            toast.success('성공적으로 저장되었습니다.');
        }
        catch (error) {
            console.error("저장 중 에러 발생", error);
            toast.error('저장에 실패했습니다.');
        }
        finally {
            setSaving(false); // 성공하든 실패하든 무조건 락을 해제하여 다음 저장을 허용합니다.
        }

    }, [isLoggedIn, saving, projectId, projectTitle, canvasW, canvasH, stageRef, setSearchParams, state.frames, layerCanvasRefs])

    const openSaveModal = useCallback(() => {
        if (!isLoggedIn) {
            toast.error('로그인이 필요합니다.');
            return;
        }
        setIsSaveModalOpen(true);
    }, [isLoggedIn]);

    // ── [ 컴포넌트가 사용할 무기들을 반환] ──────────────────
    return {
        isSaveModalOpen,
        setIsSaveModalOpen,
        projectId,
        setProjectId,
        projectTitle,
        setProjectTitle,
        editingTitle,
        setEditingTitle,
        saving,
        handleSave,
        openSaveModal,
        layerCanvasRefs
    };
};