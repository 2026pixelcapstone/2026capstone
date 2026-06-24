// download.ts
export async function downloadFileForced(url: string, filename?: string): Promise<void> {
  const fallbackTab = window.open('', '_blank')
  try {
    // 💡 1. 캐시 우회를 위한 고유 쿼리 파라미터 추가
    const fetchUrl = url.includes('?') 
      ? `${url}&_t=${Date.now()}` 
      : `${url}?_t=${Date.now()}`

    // 💡 2. 우회된 URL로 fetch 요청 (캐시를 타지 않음)
    const res = await fetch(fetchUrl)
    
    if (!res.ok) throw new Error(`fetch failed: ${res.status} ${res.statusText}`)
    
    const blob = await res.blob()
    const objUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = objUrl
    
    const name = filename || decodeURIComponent(url.split('?')[0].split('/').pop() || '') || 'download'
    a.download = name
    
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(objUrl)
    fallbackTab?.close()
  } catch (err) {
    // 💡 3. 실제 운영 환경에서 fetch가 왜 실패했는지 콘솔에 기록
    console.error('다운로드 강제 처리 실패:', err)
    
    if (fallbackTab) { 
      fallbackTab.opener = null; 
      fallbackTab.location.href = url 
    } else {
      window.open(url, '_blank', 'noopener')
    }
  }
}