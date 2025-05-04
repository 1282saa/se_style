# 맞춤형 한국어 교열 서비스

두 가지 버전의 교열 결과를 제공하는 한국어 기사 교열 서비스입니다. 이 서비스는 사용자가 제출한 기사에 대해 두 가지 다른 스타일의 교정 결과를 생성하고, 사용자 피드백을 통해 맞춤형 시스템으로 발전시키는 것을 목표로 합니다.

## 개발 현황

현재 이 프로젝트는 다음과 같은 개발 상태에 있습니다:

- **백엔드**: Express.js 기반 API 서버 개발 완료

  - 기사 교정, 스타일 가이드 검색, 사용자 피드백 저장 기능 구현
  - MongoDB 연동 및 데이터 모델 구현
  - Claude API 연동을 통한 LLM 기반 교정 기능 구현
  - RAG 구조 구현으로 스타일 가이드 활용 기능 개발

- **프론트엔드**: React 기반 UI 개발 완료

  - 기사 입력 및 교정 결과 비교 화면 구현
  - 사용자 피드백 제출 기능 구현
  - 직관적인 UI/UX 설계로 사용성 강화

- **서비스 배포**: 초기 버전 배포 완료
  - 기본적인 교정 기능 제공 중
  - 지속적인 업데이트를 통해 기능 개선 진행 중

## 주요 기능

- **두 가지 교열 결과**: LLM을 활용한 두 가지 다른 교정 스타일 제공
  - **기본 교정**: 맞춤법, 띄어쓰기, 문법 오류만 수정
  - **향상된 교정**: 문체와 표현까지 적극적으로 개선
- **RAG 기반 스타일 가이드 적용**: 스타일북에서 관련 규칙을 검색하여 맥락에 맞는 교정 제공
- **사용자 피드백 시스템**: 사용자가 선호하는 교정 스타일 선택 및 평가 가능
- **맞춤형 시스템**: 사용자의 선택 데이터를 학습하여 점차 개인화된 교정 제공

## 기술 스택

### 백엔드

- **Node.js / Express.js**: RESTful API 구현
- **MongoDB**: 데이터 저장 (교열 요청, 결과, 사용자 선택 데이터)
- **Anthropic Claude API**: LLM 기반 텍스트 교정 및 임베딩
- **Vector DB (MongoDB Atlas Vector Search)**: 스타일북 저장 및 검색

### 프론트엔드

- **React**: 사용자 인터페이스
- **Tailwind CSS**: UI 스타일링
- **React Router**: 클라이언트 사이드 라우팅

## 설치 및 실행 방법

### 사전 요구사항

- Node.js (v14 이상)
- MongoDB (로컬 또는 Atlas)
- Anthropic Claude API 키

### 백엔드 설정

1. 백엔드 디렉토리로 이동

```bash
cd backend
```

2. 의존성 설치

```bash
npm install
```

3. 환경 변수 설정

```bash
cp .env.example .env
```

`.env` 파일을 열고 API 키 및 MongoDB 연결 정보 등을 입력합니다.

4. 서버 실행

```bash
npm run dev
```

서버가 기본적으로 http://localhost:3000 에서 실행됩니다.

### 프론트엔드 설정

1. 프론트엔드 디렉토리로 이동

```bash
cd frontend
```

2. 의존성 설치

```bash
npm install
```

3. 환경 변수 설정

```bash
echo "REACT_APP_API_URL=http://localhost:3000/api" > .env
```

4. 개발 서버 실행

```bash
npm start
```

프론트엔드가 http://localhost:3001 에서 실행됩니다.

## 프로젝트 상세 구조

```
dual-proofreading-service/
│
├── backend/                            # 백엔드 애플리케이션
│   ├── src/
│   │   ├── config/                     # 환경 설정
│   │   │   └── index.js                # 환경 변수 및 설정 관리
│   │   │
│   │   ├── controllers/                # API 컨트롤러
│   │   │   ├── article.controller.js   # 기사 관련 컨트롤러
│   │   │   ├── styleGuide.controller.js # 스타일 가이드 관련 컨트롤러
│   │   │   └── analytics.controller.js # 분석 관련 컨트롤러
│   │   │
│   │   ├── models/                     # MongoDB 모델
│   │   │   ├── article.model.js        # 기사 모델
│   │   │   ├── correction.model.js     # 교열 결과 모델
│   │   │   ├── userChoice.model.js     # 사용자 선택 모델
│   │   │   ├── proofreading.model.js   # 교정 작업 모델
│   │   │   └── styleguide.model.js     # 스타일 가이드 모델
│   │   │
│   │   ├── routes/                     # API 라우트
│   │   │   ├── index.js                # 라우트 통합
│   │   │   ├── article.routes.js       # 기사 관련 라우트
│   │   │   ├── styleguide.routes.js    # 스타일 가이드 관련 라우트
│   │   │   └── analytics.routes.js     # 분석 관련 라우트
│   │   │
│   │   ├── services/                   # 비즈니스 로직
│   │   │   ├── proofreadingService.js  # 교열 서비스 통합
│   │   │   ├── styleGuideService.js    # 스타일 가이드 서비스
│   │   │   ├── analyticsService.js     # 분석 서비스
│   │   │   ├── llm/                    # LLM 연동 관련
│   │   │   │   ├── llm.service.js      # LLM 서비스 인터페이스
│   │   │   │   ├── anthropicService.js # Anthropic Claude API 연동
│   │   │   │   ├── promptService.js    # 프롬프트 처리 서비스
│   │   │   │   ├── promptGenerator.js  # 프롬프트 생성 유틸리티
│   │   │   │   └── promptGenerator.service.js  # 교정 프롬프트 생성 서비스
│   │   │   ├── rag/                    # RAG 구현
│   │   │   │   ├── vectorSearch.js     # 벡터 검색 기능
│   │   │   │   └── embeddings.service.js # 임베딩 생성 및 관리
│   │   │   │
│   │   │   └── analytics/              # 사용자 선택 분석
│   │   │
│   │   ├── utils/                      # 유틸리티 함수
│   │   │   └── logger.js               # 로깅 유틸리티
│   │   │
│   │   └── app.js                      # 앱 엔트리포인트
│   │
│   ├── scripts/                        # 스크립트
│   │   ├── import-stylebook.js         # 스타일북 가져오기 스크립트
│   │   └── generate-embeddings.js      # 임베딩 생성 스크립트
│   │
│   ├── logs/                           # 로그 디렉토리
│   ├── .env                            # 환경 변수
│   ├── package.json                    # 백엔드 의존성 정보
│   └── README.md                       # 백엔드 설명서
│
├── frontend/                           # 프론트엔드 애플리케이션
│   ├── public/                         # 정적 파일
│   │   └── index.html                  # 메인 HTML 파일
│   │
│   ├── src/
│   │   ├── components/                 # UI 컴포넌트
│   │   │   ├── ArticleInput.js         # 기사 입력 폼 컴포넌트
│   │   │   ├── CorrectionCompare.js    # 교열 결과 비교 컴포넌트
│   │   │   ├── Header.js               # 헤더 컴포넌트
│   │   │   └── Footer.js               # 푸터 컴포넌트
│   │   │
│   │   ├── pages/                      # 페이지 컴포넌트
│   │   │   ├── HomePage.js             # 홈 페이지
│   │   │   ├── ProofreadPage.js        # 교정 페이지
│   │   │   ├── ArticleFormPage.js      # 기사 입력 폼 페이지
│   │   │   ├── ResultPage.js           # 교열 결과 페이지
│   │   │   ├── HistoryPage.js          # 교열 기록 페이지
│   │   │   └── NotFoundPage.js         # 404 페이지
│   │   │
│   │   ├── services/                   # API 호출 로직
│   │   │   └── api.js                  # API 서비스
│   │   │
│   │   ├── styles/                     # CSS 파일
│   │   │   ├── App.css                 # 앱 스타일
│   │   │   └── index.css               # 글로벌 스타일
│   │   │
│   │   ├── utils/                      # 유틸리티 함수 디렉토리
│   │   ├── index.js                    # 앱 진입점
│   │   └── App.js                      # 앱 컴포넌트
│   │
│   ├── .env                            # 환경 변수
│   ├── package.json                    # 프론트엔드 의존성 정보
│   └── tailwind.config.js              # Tailwind CSS 설정
│
└── README.md                           # 프로젝트 설명서
```

## 스타일북 상세 구조

스타일북은 한국어 교정 및 기사 작성 규칙을 담고 있는 참조 문서 모음으로, 교열 시 활용됩니다. 각 문서는 JSON 형식으로 구조화되어 있어 프로그램이 쉽게 읽고 참조할 수 있습니다.

### 자주 틀리는 말

기사 작성 시 많이 발생하는 오류 유형과 올바른 표현법을 제시합니다.

| 파일명                                            | 내용                                                                            | 라인 수 |
| ------------------------------------------------- | ------------------------------------------------------------------------------- | ------- |
| ST-GUIDE-COMMON-MISTAKES-TABLE-001.json           | 혼동하기 쉬운 표현들의 비교표 (방증/반증, 과반수/과반수 이상, 장본인/주인공 등) | 369     |
| ST-GUIDE-GRAMMAR-RULES-002.json                   | 문법적 오류 교정 규칙                                                           | 111     |
| ST-GUIDE-SPACING-RULES-001.json                   | 띄어쓰기 관련 규칙 (의존 명사, 조사 등)                                         | 221     |
| ST-GUIDE-FOREIGN-WORDS-DETAILED-001.json          | 외래어 표기 상세 규칙                                                           | 163     |
| ST-GUIDE-FOREIGN-COMPANIES-001.json               | 외국 기업명 표기 지침                                                           | 225     |
| ST-GUIDE-MULTIPLE-STANDARD-WORDS-001.json         | 복수 표준어 사용 지침                                                           | 147     |
| ST-GUIDE-MULTIPLE-STANDARD-WORDS-SUMMARY-001.json | 복수 표준어 요약 목록                                                           | 64      |
| ST-GUIDE-WRITING-CORRECTION-001.json              | 글쓰기 교정 지침                                                                | 181     |
| ST-GUIDE-NEUTRAL-EXPRESSIONS-001.json             | 중립적 표현 사용 지침                                                           | 129     |
| ST-GUIDE-CONFUSING-EXPRESSIONS-001.json           | 혼동하기 쉬운 표현 정리                                                         | 150     |
| ST-GUIDE-AMBIGUOUS-USAGES-001.json                | 모호한 표현 사용 주의사항                                                       | 91      |

### 기사작성 요령

효과적인 기사 작성을 위한 원칙과 기법을 제시합니다.

| 파일명                    | 내용                                                                       | 라인 수 |
| ------------------------- | -------------------------------------------------------------------------- | ------- |
| ST-GUIDE-WRITING-001.json | 기사 작성의 기본 원칙(1기사 1주제, 1문장 1정보, 리드 작성법, 문장 요건 등) | 250     |
| ST-GUIDE-WRITING-002.json | 기사 유형별 작성 요령(스트레이트, 해설, 르포, 칼럼, 인터뷰 등)             | 151     |

### 제목과 레이아웃\_제목달기

기사 제목 작성에 관한 원칙과 기법을 제시합니다.

| 파일명                                                    | 내용                    | 라인 수 |
| --------------------------------------------------------- | ----------------------- | ------- |
| ST-JUDGE-WRITINGPRINCIPLE-TITLE-001.json                  | 제목 작성의 기본 원칙   | 181     |
| ST-JUDGE-WRITINGPRINCIPLE-ARTICELTYPE_TITLE-001.json      | 기사 유형별 제목 작성법 | 96      |
| ST-JUDGE-WRITINGPRINCIPLE-ARTICELTYPE_TITLE_EXAM-001.json | 기사 유형별 제목 예시   | 213     |

### 제목과 레이아웃\_레이아웃 요령

기사 레이아웃 구성에 관한 원칙과 기법을 제시합니다.

| 파일명                                    | 내용                  | 라인 수 |
| ----------------------------------------- | --------------------- | ------- |
| ST-JUDGE-WRITINGPRINCIPLE-LAYOUT-001.json | 레이아웃 원칙 및 지침 | 161     |

### 기사 작성 준칙

기사 작성 시 준수해야 할 구체적인 표기 규칙들을 제시합니다.

| 파일명                                           | 내용                                                          | 라인 수 |
| ------------------------------------------------ | ------------------------------------------------------------- | ------- |
| ST-JUDGE-WRITINGPRINCIPLE-MISCELLANEOUS-001.json | 신문 표기, 용어 사용, 시간 표현, 크레디트 표기 등 기타 표기법 | 206     |
| ST-JUDGE-WRITINGPRINCIPLE-PUNCTUATION-001.json   | 문장부호 사용 규칙                                            | 200     |
| ST-JUDGE-WRITINGPRINCIPLE-NUMBER-001.json        | 숫자 표기 규칙                                                | 213     |
| ST-JUDGE-WRITINGPRINCIPLE-TIMEDATE-001.json      | 시간과 날짜 표기 규칙                                         | 163     |
| ST-JUDGE-WRITINGPRINCIPLE-PLACE-001.json         | 장소 표기 규칙                                                | 103     |
| ST-JUDGE-WRITINGPRINCIPLE-ORGANIZATION-001.json  | 기관 및 단체명 표기 규칙                                      | 133     |
| ST-JUDGE-WRITINGPRINCIPLE-NAME-001.json          | 인명 표기 규칙                                                | 101     |

### 뉴스가치 판단

뉴스로서의 가치를 판단하는 기준을 제시합니다.

| 파일명                      | 내용                                                                         | 라인 수 |
| --------------------------- | ---------------------------------------------------------------------------- | ------- |
| ST-GUIDE-NEWSVALUE-001.json | 뉴스 가치 판단의 10가지 기본 요소(영향성, 특이성, 시의성, 근접성, 저명성 등) | 147     |

## 스타일북 문서 구조 예시

스타일북의 각 문서는 아래와 같은 JSON 구조로 되어 있습니다:

```json
{
  "rule_id": "ST-GUIDE-COMMON-MISTAKES-TABLE-001",
  "versions": [
    {
      "version": "v1.0",
      "status": "active",
      "created_at": "2025-05-03T00:00:00Z",
      "last_updated": "2025-05-03T00:00:00Z",
      "structure": {
        "title": "자주 틀리는 말 - 표현 비교표",
        "rule_path": ["작성원칙", "올바른표현"],
        "description": "기사 작성 시 혼동하기 쉬운 표현들을 표 형태로 정리해 비교한 지침입니다.",
        "hint": "표현의 정확한 의미 차이를 이해하면 더 정확한 기사를 작성할 수 있습니다.",
        "tags": ["혼동표현", "유사단어", "의미구분", "비교표"],
        "guidelines": [
          // 실제 규칙 내용
        ]
      }
    }
  ]
}
```

## 스타일북 활용 방식

스타일북의 문서들은 교열 서비스에서 다음과 같이 활용됩니다:

1. **벡터 DB 저장**: 각 규칙이나 항목별로 임베딩하여 벡터 DB에 저장합니다.
2. **관련 규칙 검색**: 사용자가 입력한 기사 텍스트를 분석하여 관련된 스타일북 규칙을 검색합니다.
3. **컨텍스트 추가**: 검색된 규칙을 LLM 프롬프트에 추가하여 맥락에 맞는 교정을 수행합니다.
4. **교정 적용**: 두 가지 다른 프롬프트에 각각 관련 스타일북 규칙을 적용하여 다른 교정 스타일을 제공합니다.

### 스타일북 규칙 예시 (자주 틀리는 말)

```
[표현 비교] "방증"은 주변상황을 밝힘으로써 간접적 증명에 도움을 주는 것이고, "반증"은 반대되는 증거를 들어 증명하는 것입니다.

[표현 비교] "과반수"는 반을 넘은 수를 의미하므로, "과반수 이상"은 틀린 표현입니다.

[옳은 표현] "까무러치다"가 맞고 "까무라치다"는 틀린 표현입니다.
```

### 기사 작성 원칙 예시

```
[기본 원칙] 한 건의 기사에서는 한 가지 주제만을 다뤄야 합니다(1기사 1주제).

[문장 작성] 하나의 문장에는 한 가지 사실만 전달하세요(1문장 1정보).

[리드 작성] 리드는 기사 내용 가운데 가장 중요한 핵심을 간결하게 전달하는 역할을 합니다.
```

## 서비스 흐름

1. **사용자 입력(교열 전 기사)**

   - 사용자가 `ArticleInput` 컴포넌트를 통해 작성한 원문 기사를 입력합니다.

2. **두 가지 교열 결과 생성**

   - 백엔드에서 기사 내용을 분석하여 관련된 스타일북 규칙을 검색합니다.
   - 검색된 규칙을 포함하여 두 가지 서로 다른 프롬프트로 교열 결과를 생성합니다.
   - 프롬프트1: 최소한의 간결한 교열 (맞춤법, 표기법 오류만 수정)
   - 프롬프트2: 문체/어휘까지 적극 개입해서 다듬기

3. **사용자 선택**

   - 사용자는 `CorrectionCompare` 컴포넌트를 통해 두 가지 교정 결과를 비교하고 선호하는 버전을 선택합니다.
   - 별점과 코멘트를 통해 추가적인 피드백을 제공할 수 있습니다.

4. **맞춤형 시스템으로 고도화**
   - 선택된 결과와 사용자 피드백은 데이터베이스에 저장됩니다.
   - 이 데이터는 분석 서비스를 통해 사용자 선호도 패턴을 파악하는 데 사용됩니다.
   - 장기적으로 개인화된 교열 제안 시스템으로 발전합니다.

## API 엔드포인트

### 기사 관련 API

- `POST /api/articles`: 새 기사 생성
- `GET /api/articles/:id`: 특정 기사 조회
- `GET /api/articles`: 사용자별 기사 목록 조회
- `POST /api/articles/quick-proofread`: 빠른 교정 수행
- `POST /api/articles/:id/proofread`: 특정 기사 교정
- `GET /api/articles/:id/corrections`: 특정 기사의 교정 결과 조회
- `POST /api/articles/:id/choose`: 사용자 선택 저장

### 스타일 가이드 관련 API

- `GET /api/styleguides`: 스타일 가이드 목록 조회
- `GET /api/styleguides/:id`: 특정 스타일 가이드 조회
- `POST /api/styleguides`: 스타일 가이드 생성
- `PUT /api/styleguides/:id`: 스타일 가이드 업데이트
- `DELETE /api/styleguides/:id`: 스타일 가이드 삭제
- `POST /api/styleguides/search`: 관련 스타일 가이드 검색
- `POST /api/styleguides/import`: 스타일북 가져오기
- `POST /api/styleguides/generate-embeddings`: 임베딩 생성
- `POST /api/styleguides/vector-search`: 벡터 검색 테스트

### 분석 관련 API

- `GET /api/analytics/user-preferences/:userId`: 사용자별 교정 선호도 분석
- `GET /api/analytics/stats`: 전체 서비스 통계
- `GET /api/analytics/correction-time`: 교정 시간 통계
- `GET /api/analytics/common-corrections`: 자주 발생하는 교정 유형
- `GET /api/analytics/prompt-preferences`: 프롬프트 유형별 선호도
- `GET /api/analytics/feedback`: 사용자 피드백 통계
- `GET /api/analytics/category-stats`: 카테고리별 교정 통계

## 향후 개발 계획

1. **개인화 알고리즘 고도화**

   - 사용자별 선호도 패턴 분석 시스템 개발
   - 사용자 맞춤형 교정 제안 알고리즘 구현

2. **스타일 가이드 확장**

   - 더 많은 분야별 교정 규칙 추가
   - 사용자 피드백을 반영한 스타일 가이드 개선

3. **성능 최적화**

   - 대용량 텍스트 처리 속도 개선
   - 캐싱 시스템 강화로 API 호출 최소화

4. **UI/UX 개선**
   - 모바일 반응형 디자인 강화
   - 사용자 경험 개선을 위한 인터페이스 업데이트

## 기여 방법

1. 이 저장소를 포크합니다.
2. 새 기능 브랜치를 만듭니다 (`git checkout -b feature/amazing-feature`).
3. 변경 사항을 커밋합니다 (`git commit -m 'Add some amazing feature'`).
4. 브랜치에 푸시합니다 (`git push origin feature/amazing-feature`).
5. Pull Request를 생성합니다.

## 라이센스

MIT License

## 연락처

프로젝트 관리자: [이메일 주소]

## 환경 설정

프로젝트 실행을 위해 다음 환경 변수를 설정해야 합니다:

```bash
# 서버 설정
PORT=3000
NODE_ENV=development
LOG_LEVEL=info

# MongoDB 설정
MONGODB_URI=mongodb://localhost:27017/proofreading-service

# Claude API 설정
ANTHROPIC_API_KEY=your_anthropic_api_key_here
CLAUDE_MODEL=claude-3-opus-20240229
EMBEDDING_MODEL=claude-3-sonnet-20240229

# 스타일북 설정
STYLE_BOOK_DIR=./data/stylebook

# CORS 설정
CORS_ORIGIN=http://localhost:3001

# 토큰 제한
TOKEN_LIMIT=16000
```

Config 파일은 src/config/index.js에 위치하며 환경 변수를 로드합니다.

## 데이터 가져오기

스타일북 데이터는 `scripts/import-stylebook.js`를 사용하여 가져올 수 있습니다:

```bash
npm run import-stylebook
```

임베딩 생성은 다음 명령으로 수행합니다:

```bash
npm run generate-embeddings
```

## 특이 사항

- 이 서비스는 **Claude API**만 사용하여 구현되었습니다. OpenAI API는 사용하지 않습니다.
- 스타일북 데이터는 `data/stylebook` 디렉토리에 JSON 형식으로 저장됩니다.
- 교정 결과의 캐싱 메커니즘이 구현되어 있어 중복 API 호출을 방지합니다.
- 모든 로그는 `logs` 디렉토리에 일별로 저장됩니다.
- 파일명 관련 주의사항:
  - `styleguide.model.js`와 같이 일부 파일명은 소문자를 사용하지만, 코드 내에서는 `styleGuide.controller.js`와 같이 카멜케이스로 참조되는 경우가 있으니 주의가 필요합니다.
  - `embeddings.service.js` 파일에서는 모델명 참조 시 대소문자에 주의해야 합니다.
