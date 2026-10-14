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
`.env.example` 에는 `SUPABASE_SERVICE_ROLE_KEY` 와 `E2E` 칸도 있는데, 이 둘은 로컬 테스트용입니다. **Vercel에는 절대 넣지 마세요.** 앱을 그냥 실행만 할 때는 위 두 값만 있으면 됩니다.
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
   - **Region 은 `Northeast Asia (Seoul)`(ap-northeast-2)** 를 고르세요. 사용자 데이터가 한국에 저장되고 속도도 빠릅니다. (해외 지역을 고르면 개인정보 처리방침에 "국외 이전"으로 적어야 합니다.) 지역은 나중에 바꿀 수 없습니다.
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

`db push` 가 테이블, 보안 규칙(RLS), 비공개 저장소(`materials`), 계정 삭제 기능을 모두 만들어 줍니다.

> **`npx supabase config push` 는 절대 실행하지 마세요.** 이 명령은 로컬 테스트용 `supabase/config.toml` 설정(이메일 가입 켜짐, `localhost` 주소 등)을 배포한 프로젝트에 그대로 덮어씁니다. 배포한 프로젝트의 로그인 설정은 항상 **대시보드에서** 바꿉니다. 이 가이드에서 쓰는 명령은 `db push` 뿐입니다.

### 2-3. Supabase 로그인 주소 설정

Supabase 대시보드 **Authentication → URL Configuration** 에서:

- **Site URL**: Vercel에서 받은 주소 (예: `https://my-app.vercel.app`)
- **Redirect URLs** 에 추가: `https://<your-domain>/auth/callback`

`<your-domain>` 은 Vercel 주소(또는 연결한 내 도메인)로 바꿉니다. 이 두 칸이 틀리면 로그인 후 엉뚱한 곳으로 이동하거나 막힙니다.

> Redirect URLs 에는 **정확한 주소만** 넣으세요. `https://*.vercel.app/**` 처럼 `*` 나 `**` 가 들어간 주소(와일드카드)는 넣지 않습니다. 다른 사람의 사이트로 로그인 정보가 넘어갈 수 있습니다.

### 2-4. 구글 로그인 연결

1. <https://console.cloud.google.com> 에서 프로젝트를 만듭니다.
2. **API 및 서비스 → OAuth 동의 화면** 을 설정합니다(앱 이름, 이메일 등 기본 정보).
   - **대상(사용자 유형)은 `외부`** 를 고릅니다.
   - 범위(scope)는 **기본값(`openid`, `email`, `profile`)만** 씁니다. 다른 범위를 추가하지 마세요. 기본 범위만 쓰면 구글의 별도 앱 심사가 필요 없습니다.
   - 새 앱은 **테스트 중** 상태로 시작합니다. 이 상태에서는 **테스트 사용자로 등록한 구글 계정만** 로그인할 수 있고, 나머지는 "액세스 차단됨" 화면이 나옵니다. 둘 중 하나를 하세요.
     - 나 혼자(또는 친구 몇 명)만 쓸 때: **테스트 사용자** 에 내 Gmail(과 친구들 Gmail, 최대 100명)을 추가합니다.
     - 다른 학생들에게도 열 때: **앱 게시**(게시 상태 → 프로덕션으로 푸시)를 누릅니다.
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

- **서버 지역은 서울(`icn1`)** 입니다. 저장소의 `vercel.json` 에 `{"regions":["icn1"]}` 로 이미 적혀 있어서 따로 할 일은 없습니다. (대시보드 **Settings → Functions → Function Region** 에서도 확인할 수 있습니다.) Supabase(서울)와 가까워 빨라집니다.
- 보안 헤더(CSP)는 빌드할 때 `NEXT_PUBLIC_SUPABASE_URL` 값을 읽어 만듭니다. 환경 변수를 바꿨다면 **Redeploy** 로 다시 배포하세요.

### 2-6. 요금 폭탄 막기

누구나 구글 계정으로 가입해 파일을 올릴 수 있으므로, 한 사람이 저장 공간을 많이 써도 비용이 갑자기 늘지 않게 해 둡니다.

- 유료(Pro) 플랜이라면 Supabase 대시보드 **Organization → Billing** 에서 **Spend Cap(지출 한도)** 을 켜 둡니다. 무료 플랜은 요금이 나가지 않고, 한도를 넘으면 서비스가 제한됩니다.
- **Usage(사용량)** 화면에서 저장 공간과 전송량을 가끔 확인하고, 사용량 알림 메일을 받도록 설정합니다.
- Vercel 유료(Pro) 플랜이라면 **Settings → Billing → Spend Management** 에서 지출 한도와 알림을 켜 둡니다.

참고: 사용자별 저장 용량 제한과, 업로드 도중 창을 닫아 남은 파일을 정리하는 기능은 아직 없습니다. 위의 한도와 알림으로 대신 막습니다.

---

## 보안 주의

- **Vercel에 `E2E` 환경 변수를 절대 만들지 마세요.** 테스트 로그인 경로(`/auth/test-login`)는 `E2E=1` 이면서 운영 모드(production)가 아닐 때만 동작하도록 코드로 막혀 있습니다. 그래도 안전하게 아예 설정하지 않는 것이 원칙입니다. `E2E` 는 `npm run e2e` 가 로컬에서만 씁니다.
- **`SUPABASE_SERVICE_ROLE_KEY`(service-role 키)는 Vercel에도, `NEXT_PUBLIC_` 으로 시작하는 변수에도 넣지 마세요.** 이 키는 모든 보안 규칙을 무시하고 모든 사용자의 데이터를 읽고 지울 수 있습니다. `NEXT_PUBLIC_` 변수는 브라우저에 그대로 공개됩니다. 이 키는 로컬 테스트에서만 쓰입니다.
- **운영 환경의 로그인은 구글 하나만 씁니다.** 새 Supabase 프로젝트는 이메일/비밀번호 가입(Email 제공자)이 **기본으로 켜져** 있습니다. 대시보드 **Authentication → Sign In / Providers → Email** 에서 꺼 주세요. 켜 두면 누구나 직접 계정을 만들 수 있습니다. (로컬 `supabase/config.toml` 은 로컬 테스트 때문에 이메일 가입을 켜 둔 것이고, 배포한 프로젝트에는 적용되지 않습니다.)
- **`.env.local` 을 git에 올리지 마세요.** 이미 `.gitignore` 에 들어 있으니 `git add -f` 같은 강제 추가는 하지 않습니다. 실수로 키를 올렸다면 Supabase 대시보드에서 키를 즉시 재발급하세요.
- **저장소 `materials` 는 비공개를 유지하세요.** 대시보드에서 Public으로 바꾸지 마세요. 파일은 60초짜리 임시 링크로만 열리고, 본인 파일만 접근할 수 있습니다.
- **`npx supabase config push` 를 실행하지 마세요**(2-2 참고). **Redirect URLs 에 와일드카드를 넣지 마세요**(2-3 참고).

---

## 계정 삭제

사용자는 왼쪽 메뉴 맨 아래 **계정 삭제** 로 직접 탈퇴할 수 있습니다. 올린 파일을 모두 지운 뒤 계정과 모든 기록(학기, 강의, 일정, 파일 정보)을 지웁니다. 되돌릴 수 없습니다.

운영자가 대신 지워야 할 때(예: 메일로 삭제 요청)는 **순서를 지켜** 주세요.

1. Supabase 대시보드 **Storage → materials** 에서 그 사용자 ID 폴더(`<user-id>/`)를 통째로 지웁니다.
2. 그다음 **Authentication → Users** 에서 그 사용자를 지웁니다. (기록은 자동으로 함께 지워집니다.)

순서를 바꾸면 파일이 주인 없이 저장소에 남습니다.

---

## 개인정보 처리방침 체크리스트

다른 학생들에게 앱을 열기 전에, 짧은 **개인정보 처리방침** 을 만들어 로그인 화면에서 볼 수 있게 해 두세요. 아래 항목이 들어가면 됩니다. (완성된 방침이 아니라 확인용 목록입니다.)

- [ ] **수집하는 정보**: 구글 계정 이메일, 이름, 프로필 사진 주소, 구글 계정 ID, 로그인 기록(시간, IP 주소, 브라우저 정보) / 사용자가 직접 입력한 학기, 강의, 교수님, 강의실, 수업 시간, 시험·과제·일정 / 사용자가 올린 강의 자료 파일
- [ ] **수집 목적**: 로그인, 내 시간표·일정·자료 저장과 보여 주기
- [ ] **처리를 맡기는 곳(수탁자)**: Supabase(데이터베이스·로그인·파일 저장), Vercel(웹사이트 호스팅, 접속 기록), Google(로그인). 회사 이름, 나라, 맡기는 항목을 적습니다. 서울 지역을 골랐다면 저장 위치가 한국이라고 적고, 해외 지역이면 "국외 이전"으로 적습니다.
- [ ] **보관 기간**: 사용자가 계정을 삭제할 때까지. 계정 삭제 시 바로 지웁니다. (Vercel 접속 기록 등은 각 회사의 보관 기간을 따릅니다.)
- [ ] **삭제 방법**: 앱의 **계정 삭제** 버튼, 또는 운영자에게 메일로 요청
- [ ] **연락처**: 운영자 이메일 주소
- [ ] **운영자가 볼 수 있다는 점**: 운영자는 Supabase 대시보드로 저장된 내용을 볼 수 있다는 사실을 솔직하게 적습니다.
- [ ] **이용자 안내**: 다른 사람의 개인정보가 담긴 파일은 올리지 말 것, 강의 자료는 저작권이 있으니 공유하지 말 것
