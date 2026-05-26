마음가짐: <br>
<img width="847" height="959" alt="image" src="https://github.com/user-attachments/assets/a6e0ee03-98b7-47da-8636-65233a9e6521" />

---

## 프로젝트 실행 가이드

### 프론트엔드 실행 (현재 단독 실행 가능)

```bash
cd frontend
npm install       # 최초 1회만
npm install gifenc # 최초 1회만
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

> 처음 실행 시 Flyway가 V1~V9 마이그레이션을 자동 실행 → 테이블 + 테스트 데이터 생성됨.

---

### 전체 스택 동시 실행 순서

```
1. Docker Desktop 실행 (트레이 아이콘 초록색 확인)
2. docker start pixelart-db          # DB 컨테이너 시작
3. cd backend/server → gradlew bootRun   # 백엔드 시작
4. cd frontend → npm run dev         # 프론트엔드 시작
```

---

### 테스트 계정

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