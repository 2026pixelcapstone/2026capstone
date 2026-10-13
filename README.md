# 2026capstone — PixelPilot 프론트엔드

> 팀명: 익스팬션 조 | 팀장: 조성민 | 팀원: 원범석

AI 어시스턴트 기반 픽셀아트 일관성 관리 및 에셋 생태계 플랫폼(**PixelPilot**)의 React 프론트엔드.

- 🌐 서비스: `https://pixelpilot.art`

---

## 기술 스택

| 분류 | 기술 |
|---|---|
| Framework | React + Vite |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Canvas | Konva.js (`react-konva`) — 픽셀아트 에디터 |
| State | Zustand (persist) |
| HTTP | Axios |
| Realtime | `@stomp/stompjs` — 커미션 채팅(WebSocket) |
| Payment | 토스페이먼츠 결제창 SDK(테스트 모드) |
| 기타 | `gifenc` — `.ppit` 애니메이션 GIF 렌더, `react-easy-crop` — 프로필 사진 자르기 |

---

## 주요 구조

```text
frontend/src/
├── pages/        # 라우트 페이지 (갤러리·에셋·에디터·커미션·마이페이지·로그인 등)
├── components/   # 공용 컴포넌트 (Navbar·모달·TagInput·CommissionList·CommissionChat 등)
├── constants/    # 상수 정의(메뉴, 초깃값 등)
├── hooks/        # 시스템 별 기능(layer/Frame CRUD 동작, history 동작 등)
├── layouts/      # MainLayout (Navbar + 알림 폴링 + 배너)
├── api/          # 도메인별 API 모듈 (axios 래퍼)
├── store/        # Zustand 스토어 (auth·block·like·notification)
├── lib/          # ppit 파서/렌더, 다운로드, 파일검증 등 유틸
├── type/         # Api 타입 외에 도메인 타입 정의
└── utils/        # 변환 헬퍼 (ppitConvert 등)
```

---

## 프로젝트 실행 가이드

### 프론트엔드 실행 (단독 실행 가능)

```bash
cd frontend
npm install       # 최초 1회 (gifenc 등 의존성 포함)
npm run dev       # http://localhost:5173
```

> 백엔드 없이도 UI 확인 가능. 백엔드 API 호출이 필요한 기능은 연결 전까지 동작 안 함.

---

### 백엔드 실행 (Spring Boot)

> **사전 조건**: Docker Desktop 실행 중 + PostgreSQL 컨테이너 실행 중이어야 함.

**1. Docker Desktop 설치 (처음 세팅하는 경우)**

https://www.docker.com/products/docker-desktop 에서 설치 후 **재부팅**.
이후 Docker Desktop 실행 → 트레이 아이콘이 초록색인지 확인.

**2. PostgreSQL 컨테이너 실행**

기존 컨테이너가 있으면:
```bash
docker start pixelart-db
```

**처음 클론한 경우** — 컨테이너 최초 1회 생성 (PowerShell):
```powershell
docker run -d `
  --name pixelart-db `
  -e POSTGRES_DB=pixelart `
  -e POSTGRES_USER=postgres `
  -e POSTGRES_PASSWORD=1234 `
  -p 5432:5432 `
  postgres:16
```

정상 실행 확인:
```bash
docker ps   # pixelart-db 가 Up 상태이면 OK
```

**3. 백엔드 실행**

```bash
cd backend/server
.\gradlew.bat bootRun    # Windows PowerShell
./gradlew bootRun        # Mac / Linux
```

백엔드 기본 포트: `http://localhost:8080`

> 처음 실행 시 Flyway가 **V1~V39** 마이그레이션을 자동 실행 → 테이블 + 시드 데이터(카테고리·공식 팔레트·챌린지 주제 등) 생성됨.

---

### 전체 스택 동시 실행 순서

```text
1. Docker Desktop 실행 (트레이 아이콘 초록색 확인)
2. docker start pixelart-db              # DB 컨테이너 시작
3. cd backend/server → gradlew bootRun   # 백엔드 시작
4. cd frontend → npm run dev             # 프론트엔드 시작
```

---

### 테스트 계정

**프로덕션(`https://pixelpilot.art`)** — 공통 비밀번호 `PixelTest!2026`, 테스트 데이터가 채워진 계정(결제는 토스 테스트 모드)

| 이메일 | 닉네임 | 시드 역할 |
|---|---|---|
| dot_master@test.pixelpilot.art | 도트장인 | 작가 |
| pixel_bear@test.pixelpilot.art | 픽셀곰 | 작가 |
| retro_cat@test.pixelpilot.art | 레트로냥 | 작가 |
| dungeon_keep@test.pixelpilot.art | 던전지기 | 작가 |
| ninja_artist@test.pixelpilot.art | 닌자작가 | 의뢰자 |
| palette_fairy@test.pixelpilot.art | 팔레트요정 | 의뢰자 |
| sprite_lover@test.pixelpilot.art | 스프라이트러버 | 의뢰자 |
| dawn_dot@test.pixelpilot.art | 새벽도트 | 의뢰자 |

**로컬(Flyway V8 시드)**

| 이메일 | 비밀번호 | 닉네임 |
|---|---|---|
| spriteknight@test.com | password123 | SpriteKnight |
| pixelwitch@test.com | password123 | PixelWitch |
| neonbrush@test.com | password123 | NeonBrush |

---

### DB 초기화가 필요한 경우

Flyway 체크섬 에러 발생 시 (마이그레이션 SQL 파일을 수정한 경우):

```bash
docker exec pixelart-db psql -U postgres -d pixelart -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
```

이후 Spring Boot 재시작 → Flyway가 처음부터 자동 재실행됨.

---

마음가짐: <br>
<img width="847" height="959" alt="image" src="https://github.com/user-attachments/assets/a6e0ee03-98b7-47da-8636-65233a9e6521" />
