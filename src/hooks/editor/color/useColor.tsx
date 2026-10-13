import { useState } from "react";

export function useColor(){
  const [fgColor, setFgColor] = useState('#2f81f7');
  const [isHexModal, setIsHexModal] = useState(false);
  const [hexInput, setHexInput] = useState('#2f81f7');
  
  // HEX 입력 → 색상 반영
  const applyHex = () => {
      if (/^#[0-9a-fA-F]{6}$/.test(hexInput)) setFgColor(hexInput)
  }

 // RGB 파싱
  const hexToRgb = (hex: string) => ({
    r: parseInt(hex.slice(1,3),16),
    g: parseInt(hex.slice(3,5),16),
    b: parseInt(hex.slice(5,7),16),
  });

  const rgb = hexToRgb(fgColor);
  
  // 슬라이더의 RGB 숫자를 다시 #ffffff 형태의 HEX 문자로 바꿔주는 함수
  const rgbToHex = (r: number, g: number, b: number) => {
    const toHex = (c: number) => {
      const hex = Math.max(0, Math.min(255, c)).toString(16);
      return hex.length === 1 ? "0" + hex : hex; // 한 자리 수면 앞에 0 채우기 (예: f -> 0f)
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  };

  // R, G, B 슬라이더를 밀 때 호출될 핵심 핸들러 함수
  const handleRgbChange = (channel: 'r' | 'g' | 'b', value: number) => {
    // 슬라이더를 민 채널만 value로 바꾸고, 나머지는 기존 rgb 값 유지
    const nextHex = rgbToHex(
      channel === 'r' ? value : rgb.r,
      channel === 'g' ? value : rgb.g,
      channel === 'b' ? value : rgb.b
    );
    
    setFgColor(nextHex);   // 에디터 메인 색상 변경 (도화지에 그려질 색)
    setHexInput(nextHex);  // 눈에 보이는 HEX 입력창 글자도 동기화
  };

  return{
    isHexModal, 
    hexInput,
    fgColor,
    rgb,
    setIsHexModal,
    setHexInput,
    setFgColor,
    applyHex, 
    handleRgbChange
  };
}