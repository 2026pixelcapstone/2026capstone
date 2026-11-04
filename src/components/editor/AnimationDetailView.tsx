import React, { useState, useEffect, useMemo } from 'react';
import { FrameData,  AnimationTag} from '../../type/editor';

interface AnimationDetailViewProps {
    isOpen: boolean;
    onClose: React.Dispatch<React.SetStateAction<boolean>>;
    frames: FrameData[];
    fps: number;
    animationTags?: AnimationTag[];
}

export function AnimationDetailView({ 
    isOpen, 
    onClose,
    frames, 
    fps, 
    animationTags 
}: AnimationDetailViewProps) {
    const [isModalPlaying, setIsModalPlaying] = useState(true);
    const [currentFrameIdx, setCurrentFrameIdx] = useState(0);
    const [activeTagId, setActiveTagId] = useState<string | null>(null);

    // 선택된 태그가 있을 경우 해당 구간만 반복하도록 계산
    const playbackRange = useMemo(() => {
        if (!frames || frames.length === 0) return { start: 0, end: 0 };
        if (activeTagId && animationTags) {
            const tag = animationTags.find(t => t.id === activeTagId);
            if (tag) return { start: tag.fromIndex, end: tag.toIndex };
        }
        return { start: 0, end: frames.length - 1 };
    }, [frames, activeTagId, animationTags]);

    useEffect(() => {
        if (!isOpen || !isModalPlaying || !frames || frames.length === 0) return;

        // 글로벌 FPS를 우선 사용하되, 개별 프레임의 duration이 설정되어 있으면 그것을 사용
        const defaultDelay = 1000 / fps;
        const currentFrame = frames[currentFrameIdx];
        const delay = currentFrame?.duration || defaultDelay;

        const timerId = setTimeout(() => {
            let nextIndex = currentFrameIdx + 1;
            if (nextIndex > playbackRange.end || nextIndex < playbackRange.start) {
                nextIndex = playbackRange.start;
            }
            setCurrentFrameIdx(nextIndex);
        }, delay);

        return () => clearTimeout(timerId);
    }, [isOpen, isModalPlaying, currentFrameIdx, frames, playbackRange, fps]);

    // 모달이 열릴 때 상태 초기화
    useEffect(() => {
        if (isOpen) setIsModalPlaying(true);
    }, [isOpen]);

    if (!isOpen) return null;

    const currentFrame = frames[currentFrameIdx];

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
            <div className="flex flex-col w-full max-w-4xl h-full max-h-[80vh] bg-[#1e2329] border border-gray-700 rounded-lg shadow-2xl overflow-hidden">
                {/* 헤더 */}
                <div className="flex items-center justify-between px-6 py-4 bg-[#161a1f] border-b border-gray-700">
                    <h2 className="text-white font-bold tracking-tight">애니메이션 전체 화면</h2>
                    <button onClick={() => onClose(!isOpen)} className="text-gray-400 hover:text-white transition-colors">
                        <span className="material-symbols-outlined text-2xl">close</span>
                    </button>
                </div>

                {/* 뷰어 영역 (checkerboard 배경) */}
                <div className="flex-1 flex items-center justify-center checkerboard relative overflow-hidden bg-[#1a1c23]">
                    {!frames || frames.length === 0 ? (
                        <div className="text-gray-500">프레임 데이터가 없습니다.</div>
                    ) : (
                        <div className="relative w-64 h-64 sm:w-96 sm:h-96 scale-150 transition-transform">
                            {currentFrame?.layers
                                .filter(layer => layer.isVisible)
                                .map(layer => {
                                    if (!layer.pixelData) return null;
                                    return (
                                        <img
                                            key={layer.id}
                                            src={layer.pixelData}
                                            alt={layer.name}
                                            className="absolute inset-0 w-full h-full object-contain"
                                            style={{
                                                imageRendering: 'pixelated',
                                                opacity: layer.opacity / 100,
                                                mixBlendMode: layer.blendMode?.toLowerCase() as any
                                            }}
                                        />
                                    );
                                })}
                        </div>
                    )}
                </div>

                {/* 하단 컨트롤러 */}
                <div className="flex flex-col gap-4 px-6 py-4 bg-[#161a1f] border-t border-gray-700">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => setIsModalPlaying(!isModalPlaying)}
                            className="flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-medium transition-colors"
                        >
                            <span className="material-symbols-outlined text-sm">
                                {isModalPlaying ? 'pause' : 'play_arrow'}
                            </span>
                            {isModalPlaying ? '일시정지' : '재생'}
                        </button>
                        <span className="text-gray-400 text-sm tabular-nums">
                            Frame: {currentFrameIdx} / {frames.length > 0 ? frames.length - 1 : 0}
                        </span>
                        <span className="text-gray-400 text-sm tabular-nums ml-2">
                            {fps} FPS
                        </span>
                    </div>

                    {/* 태그 필터 (태그가 존재하는 경우에만 표시) */}
                    {animationTags && animationTags.length > 0 && (
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-gray-500 text-xs mr-1">Tags:</span>
                            <button
                                onClick={() => {
                                    setActiveTagId(null);
                                    setCurrentFrameIdx(0);
                                }}
                                className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                                    activeTagId === null 
                                    ? 'bg-gray-700 border-gray-400 text-white' 
                                    : 'bg-[#1a1c23] border-gray-700 text-gray-400 hover:bg-gray-800'
                                }`}
                            >
                                All
                            </button>
                            {animationTags.map(tag => (
                                <button
                                    key={tag.id}
                                    onClick={() => {
                                        setActiveTagId(tag.id);
                                        setCurrentFrameIdx(tag.fromIndex);
                                    }}
                                    className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded-full border transition-colors ${
                                        activeTagId === tag.id 
                                        ? 'bg-gray-700 text-white' 
                                        : 'bg-[#1a1c23] border-gray-700 text-gray-400 hover:bg-gray-800'
                                    }`}
                                    style={activeTagId === tag.id ? { borderColor: tag.color } : {}}
                                >
                                    <span style={{ color: tag.color }}>●</span>
                                    {tag.name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}