# 한끗

2026 금융 AI Challenge 예선용 웹 MVP입니다.

금융상품 설명을 읽었다는 사실이 아니라, 사용자가 실제로 어떤 계약 규칙을 형성했는지 확인합니다. 사용자가 자신의 말로 이해를 설명하면 생성형 AI가 이를 구조화하고, 사전에 고정한 계약조건 및 별도의 Rule Engine이 실제 결과를 계산합니다.

## MVP 흐름

1. 가상 Step-down ELS 핵심조건 확인
2. 사용자가 이해한 내용을 자유롭게 서술
3. 생성형 AI가 `ruleId / understanding / evidence`로 구조화
4. 사용자 이해와 실제 Worst-of 계약조건 비교
5. KOSPI200 94%, S&P500 93%, EuroStoxx50 61% 가상상황에서 결과 예상
6. deterministic Rule Engine으로 실제 결과 계산
7. 예상 결과와 실제 결과 및 결과를 바꾼 한끗 비교

추가 질문, 새로운 상황 재확인, 다상품 지원은 1차 MVP에서 제외했습니다.

## 가상상품 규칙

- 판단 기준: 세 기초자산 중 가장 낮은 값(Worst-of)
- 만기 상환 기준: 최초 기준가 대비 80% 이상
- 기준 충족 시: 원금의 108% 상환, 만기 총수익률 +8%
- 기준 미충족 시: Worst-of 수준만큼 상환
- 대표 시나리오: `min(94%, 93%, 61%) = 61%`
- 실제 결과: 원금의 61% 상환, 총수익률 -39%

모든 비율은 정수 basis point로 계산합니다. 이번 대표 시나리오에는 과거 관찰 경로가 없으므로 조기상환과 Knock-In은 계산하지 않습니다.

## 기술 구성

- Next.js App Router + React + TypeScript
- `POST /api/analyze`: Gemini `generateContent`의 JSON Structured Output으로 사용자 이해 분석
- Rule Engine: 고정된 상품 및 시나리오만 pure 금융 계산 로직으로 처리
- Zod: 요청 및 AI 응답 검증
- Vitest: 금융 경계값, 입력 검증, fallback 분석 테스트
- Vercel에 그대로 배포 가능한 단일 프로젝트

API 키가 없거나 AI 연결이 실패하면 고정 데모 문장에 한해 제한적인 안전 데모 분석을 사용하며, 화면에서 해당 상태를 명확히 표시합니다. 근거가 없는 문장은 오해로 만들어내지 않고 `ABSTAINED` 처리합니다.

## 로컬 실행

Node.js 22 LTS(22.12 이상) 또는 24 LTS가 필요합니다.

```bash
npm install
cp .env.example .env.local
npm run dev
```

브라우저에서 `http://localhost:3000`을 엽니다.

실제 생성형 AI 분석을 사용하려면 `.env.local`에 서버 전용 키를 설정합니다.

```dotenv
GEMINI_API_KEY=your_api_key
GEMINI_MODEL=gemini-2.5-flash-lite
```

브라우저에 노출되는 `NEXT_PUBLIC_` 변수에는 API 키를 넣지 마세요.

## 검증

```bash
npm run lint
npm test
npm run build
```

권장 심사용 샘플 문장:

> 세 지수는 평균적으로 보는 걸로 이해했어요. 하나가 많이 떨어져도 다른 두 지수가 괜찮으면 되는 거 아닌가요?

## 배포

Vercel에서 이 디렉터리를 Next.js 프로젝트로 가져온 뒤 `GEMINI_API_KEY`와 선택 사항인 `GEMINI_MODEL`을 서버 환경변수로 등록하면 됩니다. 별도 DB, 회원가입, 외부 금융데이터 연결은 필요하지 않습니다.

## 안전 원칙

- 생성형 AI는 자연어 의미 분석과 근거 추출만 수행합니다.
- Worst-of, 상환 기준, 손익률, 상환금은 Rule Engine만 계산합니다.
- AI의 `evidence`는 사용자 원문의 정확한 부분 문자열인지 서버에서 다시 확인합니다.
- 입력 원문은 애플리케이션 로그에 남기지 않으며 Gemini API 요청은 서버에서만 전송합니다.
- 본 상품과 수치는 이해검증을 위한 가상 사례이며 투자 권유가 아닙니다.
