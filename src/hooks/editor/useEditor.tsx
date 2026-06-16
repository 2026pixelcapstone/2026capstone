//import { Layer } from "konva/lib/Layer";
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
    const [isSaveModalOpen, setIsSaveModalOpen] = useState(false)
    const [projectId, setProjectId]       = useState<number | null>(null)
    const [projectTitle, setProjectTitle] = useState('Untitled Project')
    const [editingTitle, setEditingTitle] = useState(false)
    const [saving, setSaving]             = useState(false)

    // ── 프로젝트 서버 저장 로직 ──────────────────────────────────────────
    const handleSave = useCallback(async (saveData?: SaveData) => {
        if (!isLoggedIn) { toast.error('로그인이 필요합니다.'); return }
        if (saving) return;

        const canvas = stageRef.current;
        if (!canvas) return;

        const nextTitle = saveData?.title.trim() || projectTitle.trim();
        const nextIsPublic = saveData?.isPublic || false;

        if (!nextTitle) {
            toast.error('프로젝트 이름을 입력해주세요');
            return;
        }

        setSaving(true);
        try {
            const uploadFormData = new FormData();
            const uploadedLayerKeys: string[] = [];
            uploadFormData.append("folder", "pixel-art");

            const thumDataURL = canvas.toDataURL({
                mimeType: 'image/webp',
                quality: 0.7,
                pixelRatio: 1
            });
            const thumbResponse = await fetch(thumDataURL);
            const thumbnailBlob = await thumbResponse.blob();
            uploadFormData.append('files', thumbnailBlob, 'thumbnail.webp');

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

            const uploadRes = await api.post<{ data: string[] }>("/api/files/upload/bulk", uploadFormData);
            const [uploadedThumbUrl, ...uploadedLayerUrls] = uploadRes.data.data;
            const uploadedLayerUrlByKey = new Map<string, string>();
            uploadedLayerKeys.forEach((key, idx) => {
                const url = uploadedLayerUrls[idx];
                if (url) uploadedLayerUrlByKey.set(key, url);
            });

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

            const layersToSave: LayerSaveRequest[] = state.frames.flatMap((frame, fIdx) =>
                frame.layers.map((layer: LayerData): LayerSaveRequest => {
                    const cleanId = String(layer.id).trim();
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
                        pixelData: ""
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
            setSaving(false);
        }

    }, [isLoggedIn, saving, projectId, projectTitle, canvasW, canvasH, stageRef, setSearchParams, state.frames, layerCanvasRefs])

    const openSaveModal = useCallback(() => {
        if (!isLoggedIn) {
            toast.error('로그인이 필요합니다.');
            return;
        }
        setIsSaveModalOpen(true)
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
}
