import { Link } from 'react-router-dom'

/**
 * 전역 푸터 — MainLayout 하단(에디터 경로 제외).
 * AbuseIPDB Contributor 배지: 우리가 신고(Report)한 악성 IP 수를 보여주는 공식 위젯.
 * (백엔드 AbuseIpFilter/LoginAbuseReporter — IP 평판 차단 + brute-force 신고)
 */
export default function Footer() {
  return (
    <footer className="mt-16 border-t" style={{ borderColor: 'var(--color-surface-container)', background: 'var(--color-background)' }}>
      <div className="max-w-[1440px] mx-auto px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-xs leading-relaxed text-center sm:text-left" style={{ color: 'var(--color-on-surface-variant)' }}>
          <span className="font-bold" style={{ color: 'var(--color-on-surface)' }}>PixelPilot</span>
          <span className="mx-2">·</span>팀 익스팬션 조 — 캡스톤 디자인 프로젝트
          <div className="mt-1">
            <Link to="/gallery/free" className="hover:text-white transition-colors">갤러리</Link>
            <span className="mx-2">·</span>
            <Link to="/assets" className="hover:text-white transition-colors">에셋 스토어</Link>
            <span className="mx-2">·</span>
            <Link to="/commission" className="hover:text-white transition-colors">커미션</Link>
          </div>
        </div>
        {/* AbuseIPDB Contributor 배지 — 신고 기여 수 표시(외부 위젯) */}
        <a href="https://www.abuseipdb.com/user/322808" target="_blank" rel="noopener noreferrer"
          title="AbuseIPDB is an IP address blacklist for webmasters and sysadmins to report IP addresses engaging in abusive behavior on their networks"
          className="shrink-0 opacity-80 hover:opacity-100 transition-opacity">
          <img src="https://www.abuseipdb.com/contributor/322808.svg"
            alt="AbuseIPDB Contributor Badge" className="h-10 w-auto" loading="lazy" />
        </a>
      </div>
    </footer>
  )
}
