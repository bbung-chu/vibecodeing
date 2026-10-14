# 설치와 배포 가이드

강의 정리 앱을 내 컴퓨터에서 실행하고, 인터넷에 배포하는 방법을 순서대로 적었습니다.
명령어는 터미널(프로젝트 폴더)에서 그대로 복사해서 실행하면 됩니다.

> **먼저 [보안 주의](#보안-주의) 부분을 꼭 읽어 주세요.**

---

## 1. 내 컴퓨터에서 실행하기

### 1-1. 준비물

- **Node.js 22**: <https://nodejs.org> 에서 설치합니다. `node -v` 로 버전을 확인하세요.
- **Docker**: 내 컴퓨터에 가짜 Supabase(데이터베이스, 로그인, 파일 저장소)를 띄울 때 필요합니다. Docker Desktop을 설치하고 실행해 두세요.

### 1-2. 설치

```bash
npm install
```

### 1-3. 로컬 Supabase 켜기

```bash
npx supabase start
```

처음에는 이미지를 내려받느라 몇 분 걸립니다. 끝나면 `supabase/migrations` 의 테이블과 비공개 저장소(`materials`)가 자동으로 만들어집니다.

### 1-4. `.env.local` 만들기

```bash
npx supabase status -o env
```

출력에서 아래 두 값을 찾아 프로젝트 맨 위 폴더에 `.env.local` 파일을 만들어 넣습니다.

```
NEXT_PUBLIC_SUPABASE_URL=<출력의 API_URL 값>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<출력의 ANON_KEY 값>
```

`.env.example` 파일에 같은 이름의 빈 칸이 있으니 복사해서 채워도 됩니다.
`.env.local` 은 `.gitignore` 에 들어 있어서 git에 올라가지 않습니다. 그대로 유지하세요.

### 1-5. 앱 실행

```bash
npm run dev
```

브라우저에서 <http://localhost:3000> 을 엽니다.

> 로컬에서 구글 로그인을 쓰려면 구글 OAuth 키가 필요합니다(아래 2-4 참고). 키가 없어도 아래 테스트는 모두 돌아갑니다. 테스트는 구글 대신 테스트 전용 로그인을 쓰기 때문입니다.

### 1-6. 테스트 실행

```bash
npm run lint        # 코드 스타일 검사
npm run typecheck   # 타입 검사
npm test            # 단위 테스트
npm run test:db     # 데이터베이스(RLS) 테스트 - 로컬 Supabase가 켜져 있어야 함
npm run e2e         # 브라우저 전체 흐름 테스트 - 로컬 Supabase가 켜져 있어야 함
```

`npm run e2e` 는 개발 서버를 자동으로 띄우고 `E2E=1` 을 스스로 설정합니다. 직접 설정할 필요가 없습니다.

끌 때는 `npx supabase stop` 을 실행합니다.

---

## 2. 인터넷에 배포하기 (Supabase + Vercel)

순서가 중요합니다. 2-5의 Vercel 주소를 먼저 알아야 2-3, 2-4를 마무리할 수 있으니, **2-1, 2-2, 2-5를 먼저 한 뒤 2-3, 2-4로** 돌아와도 됩니다.

### 2-1. Supabase 프로젝트 만들기

1. <https://supabase.com> 에 가입하고 **New project** 로 프로젝트를 만듭니다.
2. 데이터베이스 비밀번호를 정하고 안전한 곳에 적어 둡니다.
3. 만든 뒤 **Project Settings → API** 에서 아래 두 값을 확인합니다. 주소의 `<project-ref>` 부분도 기억해 두세요.
   - Project URL (`https://<project-ref>.supabase.co`)
   - `anon` `public` 키

### 2-2. 데이터베이스 올리기

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push
```

`db push` 가 테이블, 보안 규칙(RLS), 비공개 저장소(`materials`)를 모두 만들어 줍니다.

### 2-3. Supabase 로그인 주소 설정

Supabase 대시보드 **Authentication → URL Configuration** 에서:

- **Site URL**: Vercel에서 받은 주소 (예: `https://my-app.vercel.app`)
- **Redirect URLs** 에 추가: `https://<your-domain>/auth/callback`

`<your-domain>` 은 Vercel 주소(또는 연결한 내 도메인)로 바꿉니다. 이 두 칸이 틀리면 로그인 후 엉뚱한 곳으로 이동하거나 막힙니다.

### 2-4. 구글 로그인 연결

1. <https://console.cloud.google.com> 에서 프로젝트를 만듭니다.
2. **API 및 서비스 → OAuth 동의 화면** 을 설정합니다(앱 이름, 이메일 등 기본 정보).
3. **사용자 인증 정보 → 사용자 인증 정보 만들기 → OAuth 클라이언트 ID** 를 고르고, 유형은 **웹 애플리케이션** 으로 합니다.
4. **승인된 리디렉션 URI** 에 아래 주소를 넣습니다.
   `https://<project-ref>.supabase.co/auth/v1/callback`
5. 만들어진 **클라이언트 ID** 와 **클라이언트 보안 비밀** 을 복사합니다.
6. Supabase 대시보드 **Authentication → Providers → Google** 을 켜고 두 값을 붙여 넣은 뒤 저장합니다.

### 2-5. Vercel에 배포

1. <https://vercel.com> 에 가입하고 **Add New → Project** 에서 이 GitHub 저장소를 가져옵니다(Import).
2. **Environment Variables** 에 **딱 두 개만** 넣습니다.

   | 이름 | 값 |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | 2-1의 Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 2-1의 `anon` `public` 키 |

3. **Deploy** 를 누릅니다. 끝나면 받은 주소를 2-3의 Site URL과 Redirect URL에 넣습니다.

배포 후 사이트에 접속해 **구글로 계속하기** 로 로그인되는지 확인하세요.

---

## 보안 주의

- **Vercel에 `E2E` 환경 변수를 절대 만들지 마세요.** `E2E=1` 이면 비밀번호만으로 들어가는 테스트 로그인 경로가 열립니다. 이 경로는 개발 모드에서만 동작하도록 막아 두었지만, 안전하게 아예 설정하지 않는 것이 원칙입니다. `E2E` 는 `npm run e2e` 가 로컬에서만 씁니다.
- **`SUPABASE_SERVICE_ROLE_KEY`(service-role 키)는 Vercel에도, `NEXT_PUBLIC_` 으로 시작하는 변수에도 넣지 마세요.** 이 키는 모든 보안 규칙을 무시하고 모든 사용자의 데이터를 읽고 지울 수 있습니다. `NEXT_PUBLIC_` 변수는 브라우저에 그대로 공개됩니다. 이 키는 로컬 테스트에서만 쓰입니다.
- **운영 환경의 로그인은 구글 하나만 씁니다.** Supabase 대시보드 **Authentication → Sign In / Providers** 에서 **Email** 로그인(이메일/비밀번호 가입)은 꺼 둔 채로 두세요. 켜 두면 누구나 직접 계정을 만들 수 있습니다.
- **`.env.local` 을 git에 올리지 마세요.** 이미 `.gitignore` 에 들어 있으니 `git add -f` 같은 강제 추가는 하지 않습니다. 실수로 키를 올렸다면 Supabase 대시보드에서 키를 즉시 재발급하세요.
- **저장소 `materials` 는 비공개를 유지하세요.** 대시보드에서 Public으로 바꾸지 마세요. 파일은 60초짜리 임시 링크로만 열리고, 본인 파일만 접근할 수 있습니다.
