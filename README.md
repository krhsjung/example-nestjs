# Example NestJS

NestJS 기반의 백엔드 API 서버 프로젝트입니다. Nx 모노레포 구조로 구성되어 있습니다.

## 프로젝트 구조

```
├── apps/
│   ├── api/          # 메인 REST API 서버
│   └── socket/       # WebSocket 서버
├── libs/
│   ├── common/       # 공통 설정, 서비스
│   └── utils/        # 유틸리티 함수, 데이터베이스 모듈
└── config/           # 환경별 설정 파일
    └── .env          # 로컬 전용 (development/production은 인프라 환경변수 사용)
```

## 기술 스택

- **Framework**: NestJS
- **Build Tool**: Nx, Webpack
- **Database**: PostgreSQL (TypeORM)
- **Cache**: Redis (ioredis)
- **Authentication**: JWT, OAuth (Google, Apple)

## 요구 사항

- Node.js 22+
- PostgreSQL
- Redis

## 설치

```bash
npm install
```

## 실행

### 로컬 개발 환경

```bash
# 개발 서버 실행 (watch 모드)
npx nx serve api

# 또는 특정 환경으로 실행
npx nx serve api -c local
npx nx serve api -c development
```

### 빌드

```bash
# 프로덕션 빌드 (기본값)
npx nx build api

# 환경별 빌드
npx nx build api -c local
npx nx build api -c development
npx nx build api -c production
```

### Docker

```bash
# 프로덕션 이미지 빌드 (기본값)
docker build -t example-api .

# 개발 환경 이미지 빌드
docker build --build-arg BUILD_ENV=development -t example-api:development .

# 컨테이너 실행
docker run -p 3000:3000 example-api
```

## 환경 변수

주요 환경 변수는 `config/` 디렉토리의 `.env` 파일에서 관리됩니다.

| 변수명                  | 설명              | 기본값      |
| ----------------------- | ----------------- | ----------- |
| `NODE_ENV`              | 실행 환경         | `local`     |
| `POSTGRES_PRIMARY_HOST` | PostgreSQL 호스트 | `localhost` |
| `REDIS_HOST`            | Redis 호스트      | `localhost` |
| `REDIS_PORT`            | Redis 포트        | `6379`      |
| `JWT_SECRET_KEY`        | JWT 시크릿 키     | -           |

## Nx 명령어

```bash
# 프로젝트 그래프 확인
npx nx graph

# 프로젝트 정보 확인
npx nx show project api

# 새 라이브러리 생성
npx nx g @nx/node:lib mylib

# 새 애플리케이션 생성
npx nx g @nx/nest:app demo
```

## 참고 링크

- [Nx Documentation](https://nx.dev)
- [NestJS Documentation](https://docs.nestjs.com)
