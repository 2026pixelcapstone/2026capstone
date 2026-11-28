import { PopoverPosition } from "../../type/editor";
import { useEffect, useRef, useState } from "react";

export function usePopoverPosition(){
    const panelRef = useRef<HTMLDivElement>(null); // 리소스 상세 정보를 보여주는 팝오버/드롭다운 패널의 실제 DOM 요소에 직접 접근하기 위한 참조
    const [position, setPosition] = useState<PopoverPosition>({ left: 0, top: 0, arrow: 24 }); // 상세 정보 패널이 렌더링 될 좌표와 말풍선 꼬리의 오프셋 위치 관리

    // 창 크기가 바뀌거나 화면이 스크롤될 때 말풍선이 버튼에서 떨어져 둥둥 떠다니는 현상 방지(resize, scroll 시 모달을 닫음 )
    useEffect(() => {
        const close = (event: Event) => {
            if (event.type === 'scroll' && event.target instanceof Node && panelRef.current?.contains(event.target)) return;
            panelRef.current?.hidePopover(); // 브라우저 기본 Popover API 호출
        };
        window.addEventListener('resize', close);
        window.addEventListener('scroll', close, true);
        return () => {
            window.removeEventListener('resize', close);
            window.removeEventListener('scroll', close, true);
        };
    }, []);

    return{panelRef, position, setPosition}
}
