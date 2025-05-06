# 서울경제신문 맞춤형 교열 시스템 - 백엔드 서버

## 개요

이 프로젝트는 두 가지 다른 교정 방법을 제공하는 맞춤형 교열 시스템입니다:

1. 최소 교정: 필수적인 교정만 수행
2. 적극적 교정: 스타일과 표현까지 개선하는 포괄적 교정

## 설치 및 설정

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

`.env` 파일을 생성하고 다음과 같이 설정합니다:

```
MONGODB_URI=mongodb://localhost:27017/proofreading
PORT=3000
NODE_ENV=development
USE_CHROMA=true
CHROMA_URL=http://localhost:8000
USE_RAG=true
RAG_MAX_GUIDE_TOKENS=2000
OPENAI_API_KEY=your_openai_api_key
```

## 서버 실행

### 자동 실행 스크립트 (권장)

더 쉬운 설정을 위해 자동 실행 스크립트를 사용할 수 있습니다:

```bash
# 실행 권한 부여
chmod +x run-server.sh

# 스크립트 실행
./run-server.sh
```

이 스크립트는 다음 작업을 수행합니다:

- 필요한 패키지 설치
- Nodemon 설치 여부 확인 및 설치
- .env 파일 확인 및 기본 설정 생성
- 서버 실행

### 수동 실행

#### 개발 모드 실행

```bash
npm run dev
```

또는

```bash
node src/app.js
```

## 스크립트 실행

### 스타일북 데이터 가져오기

```bash
node scripts/import-stylebook.js
```

### 임베딩 생성

```bash
node scripts/generate-embeddings.js
```

## RAG(Retrieval-Augmented Generation) 시스템

이 프로젝트는 교정 시스템의 효율성과 정확성을 높이기 위해 RAG(Retrieval-Augmented Generation) 기술을 구현했습니다. RAG는 LLM(Large Language Model)을 사용할 때 관련 데이터를 검색하여 모델의 응답을 강화하는 기법입니다.

### RAG 시스템 특징

- **문서 분류와 메타데이터 강화**: 스타일가이드 문서를 `rule`, `guideline`, `case`, `changelog` 등의 유형으로 분류하여 더 정확한 검색 결과 제공
- **문서 청킹**: 대형 문서를 의미 있는 작은 청크로 분할하여 관련성 높은 정보 검색 성능 개선
- **계층적 검색**: 상위 문서와 관련 청크를 함께 검색하여 컨텍스트를 유지하면서 세부 정보 제공
- **문서 유형 기반 검색**: 특정 유형의 문서만 검색하여 맥락에 맞는 정보 제공
- **카테고리 기반 검색**: 카테고리별로 검색 결과를 그룹화하여 체계적인 정보 제공
- **쿼리 분석 기반 전략 선택**: 쿼리 길이와 복잡성에 따라 최적의 검색 전략 자동 선택

### 구성 요소

RAG 시스템은 다음과 같은 주요 구성 요소로 이루어져 있습니다:

1. **Chroma 벡터 데이터베이스**: 문서와 청크의 임베딩을 저장하고 벡터 검색 수행
2. **임베딩 프로바이더**: OpenAI API를 사용하여 텍스트의 벡터 임베딩 생성
3. **벡터 검색 서비스**: 다양한 검색 전략과 필터링 옵션 제공
4. **RAG 서비스**: 검색 결과를 프롬프트에 통합하고 LLM 응답 강화
5. **문서 분류 및 청킹 유틸리티**: 문서 전처리 및 효율적인 검색을 위한 도구

### 설정 방법

#### 1. 환경 변수 설정

`.env` 파일에 다음 설정을 추가합니다:

```
# RAG 시스템 설정
USE_RAG=true                   # RAG 기능 활성화 여부 (기본값: true)
RAG_DEFAULT_LIMIT=5            # 기본 검색 결과 수 (기본값: 5)
RAG_MIN_SCORE=0.6              # 최소 유사도 점수 (기본값: 0.6)
RAG_MAX_GUIDE_TOKENS=2000      # 프롬프트에 포함할 최대 토큰 수 (기본값: 2000)
RAG_MAX_SECTIONS_PER_CATEGORY=3  # 카테고리당 최대 섹션 수 (기본값: 3)

# Chroma DB 설정
USE_CHROMA=true                # Chroma 벡터 데이터베이스 사용 여부
CHROMA_URL=http://localhost:8000  # Chroma 서버 URL
CHROMA_COLLECTION_NAME=styleguides  # Chroma 컬렉션 이름 (선택사항)

# OpenAI API 설정 (임베딩 생성에 필요)
OPENAI_API_KEY=your_openai_api_key
```

#### 2. Chroma DB 실행

Docker로 Chroma 서버를 실행합니다:

```bash
docker run -p 8000:8000 chromadb/chroma
```

또는 Python으로 직접 실행:

```bash
pip install chromadb
python -c "import chromadb; chromadb.Server().run()"
```

#### 3. 스타일북 가져오기 및 임베딩 생성

```bash
# 스타일북 가져오기 (doc_type 자동 분류 및 청킹 포함)
node scripts/import-stylebook.js [스타일북 디렉토리 경로]

# 임베딩 생성 확인 (필요시)
node scripts/generate-embeddings.js
```

### 사용 방법

RAG 시스템은 기존 교정 워크플로우에 자동으로 통합됩니다. `proofreadingService.js`가 자동으로 관련 스타일 가이드를 검색하고 프롬프트에 통합합니다.

#### API를 통한 사용

API 요청 시 다음 옵션을 전달하여 RAG 동작을 제어할 수 있습니다:

```json
{
  "text": "교정할 텍스트",
  "options": {
    "useHierarchical": true, // 계층적 검색 사용
    "useCategories": true, // 카테고리별 그룹화 사용
    "docType": ["rule", "guideline"], // 특정 문서 유형만 검색
    "limit": 10, // 최대 결과 수
    "minScore": 0.6 // 최소 유사도 점수
  }
}
```

### 검색 전략

RAG 시스템은 쿼리 특성에 따라 다음 전략을 자동으로 선택합니다:

1. **기본 검색**: 짧은 쿼리에 적합
2. **계층적 검색**: 긴 텍스트(>500자)에 적합, 상위 문서와 관련 청크 함께 검색
3. **문서 유형 기반 검색**: 특정 유형의 가이드만 필요할 때 유용
4. **카테고리 기반 검색**: 결과를 카테고리별로 구조화할 때 유용
5. **통합 검색**: 중간 길이 텍스트(>100자)에 적합, 여러 전략의 결과 통합

## API 테스트

API 테스트 스크립트를 실행하여 교정 기능을 테스트할 수 있습니다:

```bash
node test-api.js
```

이 테스트 스크립트는 세 가지 테스트 케이스를 실행합니다:

1. 맞춤법 오류 테스트
2. 외래어 표기 테스트
3. 문체/표현 개선 테스트

각 테스트는 원문과 두 가지 다른 교정 결과(최소 교정과 적극적 교정)를 보여줍니다.

## RAG 테스트

RAG 시스템을 테스트하려면 다음 스크립트를 실행할 수 있습니다:

```bash
node test-rag.js
```

이 스크립트는 다음 테스트를 수행합니다:

1. 기본 RAG 검색 테스트
2. 계층적 검색 테스트
3. 문서 유형 기반 검색 테스트
4. 카테고리 기반 검색 테스트
5. 프롬프트 강화 테스트

## 주의사항

- 서버 실행 전에 MongoDB가 실행 중인지 확인하세요.
- RAG 시스템을 사용하려면 Chroma 서버가 실행 중이어야 합니다.
- 스타일북 데이터를 가져온 후에 임베딩을 생성해야 합니다.
- API 테스트는 서버가 실행 중일 때만 성공적으로 수행됩니다.

## 문제 해결

### 실행 오류

#### nodemon 명령어를 찾을 수 없음

오류 메시지: `sh: nodemon: command not found`

해결 방법:

```bash
npm install -g nodemon
```

또는

```bash
npx nodemon src/app.js
```

#### 권한 문제로 글로벌 설치 실패

오류 메시지: `npm error Error: EACCES: permission denied, mkdir '/usr/local/lib/node_modules/nodemon'`

해결 방법:

```bash
# sudo를 사용하여 설치
sudo npm install -g nodemon

# 또는 권한 문제 없이 npx 사용
npx nodemon src/app.js
```

#### 모듈을 찾을 수 없음

오류 메시지: `Error: Cannot find module '../models/proofreading.model'`

이 오류는 필요한 모델 파일이 누락되었을 때 발생합니다. 모든 모델 파일이 `src/models` 디렉토리에 있는지 확인하세요.

#### dotenv 관련 오류

오류 메시지: `Error: Cannot find module 'dotenv'`

해결 방법:

```bash
npm install dotenv
```

#### 환경 변수 로드 문제

오류 메시지: `The `uri`parameter to`openUri()` must be a string, got "undefined"`

이 오류는 .env 파일이 제대로 로드되지 않아서 MongoDB URI가 undefined로 설정되었을 때 발생합니다.

해결 방법:

1. .env 파일이 프로젝트 루트 디렉토리에 있는지 확인
2. 파일 내용이 올바른지 확인:
   ```
   MONGODB_URI=mongodb://localhost:27017/proofreading
   PORT=3000
   NODE_ENV=development
   ```
3. dotenv가 올바르게 설정되었는지 확인:

   ```javascript
   // 파일 맨 위에 위치해야 함
   require("dotenv").config();

   // 그 후에 환경 변수 사용
   const mongoURI = process.env.MONGODB_URI;
   ```

### 데이터베이스 문제

#### MongoDB 연결 오류

오류 메시지: `MongoDB 연결 오류: connect ECONNREFUSED ::1:27017, connect ECONNREFUSED 127.0.0.1:27017`

이 오류는 MongoDB 서버가 실행되고 있지 않을 때 발생합니다.

해결 방법:

MongoDB가 실행 중인지 확인하세요. MongoDB가 설치되어 있지 않다면 다음 명령어로 설치할 수 있습니다:

macOS (Homebrew 사용):

```bash
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community
```

또는 Docker를 사용하여 MongoDB 실행:

```bash
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

실행 상태 확인:

```bash
# Homebrew 설치 시
brew services list | grep mongodb

# 직접 확인
ps aux | grep mongod
```

#### MongoDB가 설치되어 있지 않은 경우 대안

개발 및 테스트를 위해 MongoDB Atlas의 무료 클러스터를 사용할 수 있습니다:

1. [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register)에 가입
2. 무료 클러스터 생성
3. 네트워크 액세스 허용 (IP 추가)
4. 데이터베이스 사용자 생성
5. 연결 문자열을 .env 파일에 추가:
   ```
   MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/proofreading?retryWrites=true&w=majority
   ```

#### 스타일북 데이터 가져오기 문제

스타일북 데이터를 가져올 때 문제가 발생하면 다음을 확인하세요:

- MongoDB가 실행 중인지 확인
- `.env` 파일에 올바른 MongoDB URI가 설정되어 있는지 확인
- 필요한 모델 파일이 모두 존재하는지 확인

### Chroma DB 문제

#### Chroma 서버 연결 오류

오류 메시지: `Chroma 벡터 검색 오류: Failed to fetch, ECONNREFUSED 127.0.0.1:8000`

이 오류는 Chroma 서버가 실행되지 않거나 연결할 수 없을 때 발생합니다.

해결 방법:

1. Chroma 서버가 실행 중인지 확인
2. Docker 컨테이너가 실행 중인지 확인: `docker ps | grep chroma`
3. 포트 8000이 다른 프로세스에 의해 사용 중인지 확인: `lsof -i :8000`
4. `.env` 파일의 `CHROMA_URL` 설정이 올바른지 확인

#### 임베딩 생성 오류

오류 메시지: `임베딩 생성 오류: OpenAI API 요청 실패...`

이 오류는 OpenAI API 키가 올바르게 설정되지 않았거나 API 호출에 문제가 있을 때 발생합니다.

해결 방법:

1. `.env` 파일에 유효한 `OPENAI_API_KEY`가 설정되어 있는지 확인
2. OpenAI API 키의 요청 한도를 확인
3. 네트워크 연결 상태 확인
4. `.env` 파일이 코드에서 올바르게 로드되고 있는지 확인

#### Chroma 컬렉션 생성 오류

오류 메시지: `Chroma 벡터 추가 오류: Collection already exists...`

이 오류는 이미 존재하는 컬렉션을 다시 생성하려고 할 때 발생할 수 있습니다.

해결 방법:

1. 이미 존재하는 컬렉션 이름인 경우 오류를 무시하고 진행
2. 기존 컬렉션을 삭제하고 다시 시작하려면 Chroma REST API를 사용:
   ```bash
   curl -X DELETE http://localhost:8000/api/v1/collections/styleguides
   ```
3. 다른 컬렉션 이름 사용: `.env` 파일에서 `CHROMA_COLLECTION_NAME` 변경

### PowerShell 문제

PowerShell에서 실행 시 문제가 발생하면 기본 터미널(Terminal.app, iTerm 등)을 사용하여 명령을 실행하세요.

## 알려진 문제점 및 해결 방법

### 1. 프롬프트 템플릿 처리 오류

**문제**: `프롬프트 생성 오류: prompt.replace is not a function` 오류가 발생할 수 있습니다.

**원인**: `promptBuilder.js`의 `buildEnhancedPrompt` 메소드에서 템플릿 객체를 문자열처럼 처리하려고 시도하는 문제가 있습니다. 템플릿은 `{ prefix: "...", suffix: "..." }` 형태의 객체인데, 문자열 메소드인 `replace`를 직접 호출하려고 시도합니다.

**해결 방법**:

- `promptBuilder.js` 파일에서 `buildEnhancedPrompt` 메소드를 수정하여 템플릿 객체의 `prefix`와 `suffix` 속성을 개별적으로 처리
- `proofreadingService.js`의 `_buildCorrectionPrompt` 메소드에서 `promptBuilder.buildPrompt`를 호출하도록 수정
- `_selectPromptTemplate` 메소드가 일관된 형식의 템플릿 객체를 반환하도록 수정

### 2. Claude API 응답 처리 문제

**문제**: `구조화된 JSON 응답을 찾을 수 없음, 텍스트 전체를 교정 결과로 사용` 메시지가 로그에 표시됩니다.

**원인**: Claude API에서 반환하는 응답에서 JSON 형식의 데이터를 추출하는 과정에 문제가 있습니다. API가 프롬프트 지시를 정확히 따르지 않거나, JSON 추출 로직에 오류가 있을 수 있습니다.

**해결 방법**:

- `anthropicService.js`의 JSON 파싱 로직 검토 및 개선
- 프롬프트 템플릿에서 JSON 형식 지시를 더 명확하게 제시
- 응답에서 JSON을 추출하는 정규 표현식 개선
- 예외 처리 로직 강화

### 3. 벡터 검색 문제

**문제**: `벡터 검색 오류: $vectorSearch stage is only allowed on MongoDB Atlas`와 `메모리 내 유사도 계산 결과: 0개` 메시지가 표시됩니다.

**원인**: 로컬 MongoDB를 사용할 경우 벡터 검색 기능이 지원되지 않습니다. MongoDB Atlas는 이 기능을 제공하지만, 로컬 개발 환경에서는 사용할 수 없습니다. 따라서 메모리 내 유사도 계산으로 대체되지만, 현재 유사도 계산 결과가 0개로 나오고 있습니다.

**해결 방법**:

- 개발 환경에서는 메모리 내 유사도 계산 로직을 개선하여 더 정확한 결과 제공
- 벡터 임베딩 생성 및 저장 절차 검토
- 로컬 개발용 대체 벡터 검색 라이브러리 (예: Faiss, Annoy 등) 고려
- 프로덕션 환경에서는 MongoDB Atlas를 사용하여 정상적인 벡터 검색 활용
- 또는 `USE_CHROMA=true`로 설정하여 Chroma DB 사용 (권장)

## 기술 스택

## 벡터 데이터베이스 선택: MongoDB vs Chroma

이 프로젝트는 벡터 검색을 위해 두 가지 옵션을 지원합니다:

1. **MongoDB Atlas Vector Search** (프로덕션): 프로덕션 환경에서 사용 권장
2. **Chroma DB** (개발/로컬): 로컬 개발 환경에서 사용 권장

환경 변수 `USE_CHROMA`를 설정하여 사용할 벡터 데이터베이스를 선택할 수 있습니다:

- `USE_CHROMA=true`: Chroma DB 사용 (로컬 개발 시 권장)
- `USE_CHROMA=false` 또는 미설정: MongoDB 사용 (Atlas 제품만 벡터 검색 지원)

## Chroma DB 설정 방법

### 1. 로컬 Chroma 서버 실행 (옵션 1: Docker 사용)

```bash
docker run -p 8000:8000 chromadb/chroma
```

### 2. 로컬 Chroma 서버 실행 (옵션 2: Python으로 직접 설치)

```bash
pip install chromadb
python -c "import chromadb; chromadb.Server().run()"
```

### 3. 환경 변수 설정

```bash
# .env 파일에 추가
USE_CHROMA=true
CHROMA_URL=http://localhost:8000  # 기본값, 변경 가능
OPENAI_API_KEY=your_openai_api_key  # 임베딩 생성에 필요
```

### 4. 스타일북 및 임베딩 생성

```bash
# 스타일북 데이터 가져오기 (이제 Chroma에도 저장)
npm run import-stylebook

# 또는 누락된 임베딩만 생성
npm run generate-embeddings
```

## 벡터 데이터베이스 고려사항

### MongoDB Atlas 사용 시

- MongoDB Atlas 클러스터가 필요합니다 (무료 티어 가능)
- 벡터 검색 기능이 활성화되어 있어야 합니다
- 로컬 MongoDB 인스턴스는 벡터 검색을 지원하지 않습니다

### Chroma DB 사용 시

- 로컬 개발 및 테스트에 적합합니다
- 별도의 Chroma 서버 실행이 필요합니다 (Docker 또는 Python)
- MongoDB는 여전히 사용자 데이터 및 기타 비벡터 데이터 저장에 사용됩니다

# 서울경제신문 맞춤형 교열 시스템 - 벡터 검색 개선

## 주요 문제 및 해결 방안

### 1. 벡터 검색 관련 문제

#### 문제: `vectorSearch.findHierarchical is not a function`

MongoDB 벡터 어댑터에 계층적 검색 기능이 구현되어 있지 않아 오류가 발생했습니다.

**해결 방안:**

- MongoDB 어댑터에 `hierarchicalSearch` 메서드 구현
- `categorySearch` 메서드도 추가하여 카테고리별 검색 지원
- VectorSearch 클래스에 `findHierarchical`, `findByDocType`, `findByCategory` 메서드 추가

#### 문제: "벡터 필드가 있는 문서가 없습니다: Styleguide"

스타일가이드 문서에 임베딩 벡터가 생성되지 않아 벡터 검색이 실패했습니다.

**해결 방안:**

- 임베딩 생성 전용 스크립트 `generate-styleguide-embeddings.js` 구현
- 배치 처리 및 오류 처리 로직 추가하여 대량의 문서도 안정적으로 처리
- package.json에 새 스크립트 추가: `generate-styleguide-embeddings` 및 `setup-embeddings`

#### 문제: "모든 JSON 파싱 방법 실패", "구조화된 JSON 응답을 찾을 수 없음"

Claude API 응답에서 JSON 데이터 추출에 실패하는 경우가 있었습니다.

**해결 방안:**

- 강력한 JSON 파싱 기능을 제공하는 `responseParser.js` 유틸리티 생성
- 다양한 JSON 추출 전략 구현 (코드 블록, 중괄호 영역, 줄 단위 분석 등)
- AnthropicService의 `#parse` 메서드를 개선하여 새로운 파서 활용

## 새로 추가된 파일

### 1. `src/adapters/vector/mongodb.js` (수정)

- `hierarchicalSearch` 메서드 추가: 문서 및 관련 청크를 함께 검색하는 계층적 검색 지원
- `categorySearch` 메서드 추가: 카테고리별로 그룹화된 검색 결과 제공

### 2. `src/services/rag/vectorSearch.js` (수정)

- `findHierarchical` 메서드 추가: 계층적 검색 지원
- `findByDocType` 메서드 추가: 문서 유형별 검색 지원
- `findByCategory` 메서드 추가: 카테고리별 검색 지원
- 캐시 기능 추가로 반복 검색 성능 개선

### 3. `scripts/generate-styleguide-embeddings.js` (신규)

- 스타일가이드 문서에 대한 임베딩 벡터 생성 스크립트
- 배치 처리 로직으로 대량의 문서도 효율적으로 처리
- 임베딩 생성 오류에 대한 안전한 예외 처리

### 4. `src/services/llm/responseParser.js` (신규)

- Claude API 응답에서 JSON을 추출하는 강력한 파싱 로직
- 다양한 추출 전략: 코드 블록, 중괄호 영역, 줄 단위 분석, 키-값 구조
- 교정 결과 객체 생성 및 정리 함수 제공

### 5. `src/services/llm/anthropicService.js` (수정)

- `#parse` 메서드 개선: `responseParser` 활용
- `safeParseJSON` 메서드 개선: 단순화 및 기능 강화

## 사용 방법

### 임베딩 생성 및 검색 초기화

```bash
# 스타일가이드 문서에 대한 임베딩 생성
npm run generate-styleguide-embeddings

# 모든 임베딩 생성 (스타일가이드 + 지식 베이스)
npm run setup-embeddings

# 전체 시스템 설정 (임베딩, 날리지, 프롬프트 등)
npm run setup-all
```

### 계층적 벡터 검색 사용 예시

```javascript
// 계층적 검색 사용
const { findHierarchical } = require("./src/services/rag/vectorSearch");

// 임베딩 생성 후 계층적 검색
const embedding = await embeddingProvider.createEmbedding("검색할 텍스트");
const results = await findHierarchical(embedding, {
  limit: 5,
  minScore: 0.6,
  includeChunks: true,
});

// 결과 처리
const { documents, chunks } = results;
```

### 문제 발생 시 디버깅 요령

1. **임베딩 생성 확인**

   - 문서에 임베딩이 있는지 확인: `db.styleguides.find({ vector: { $exists: true } }).count()`
   - 없으면 임베딩 생성 스크립트 실행: `npm run generate-styleguide-embeddings`

2. **로그 확인**

   - `logs/application-*.log` 파일에서 오류 메시지 확인
   - "Chroma 문서 추가 중 오류" 또는 "벡터 필드가 있는 문서가 없습니다" 등의 메시지 체크

3. **환경 설정 확인**
   - `.env` 파일에서 `USE_CHROMA` 값 확인 (MongoDB만 사용하려면 `false` 설정)
   - 필요한 API 키 확인: `OPENAI_API_KEY` (임베딩 생성용), `ANTHROPIC_API_KEY` (Claude API 호출용)

## 추가 참고 사항

- **벡터 검색 어댑터 선택**: `.env` 파일에서 `USE_CHROMA=true` 설정 시 Chroma DB 사용, `false` 설정 시 MongoDB 사용
- **임베딩 모델**: OpenAI의 `text-embedding-3-small` 모델을 사용하여 벡터 생성 (차원: 1536)
- **LangChain 버전**: `@langchain/community` 패키지의 버전 확인 필요 (`^0.3.0` 이상 권장)
- **MongoDB 벡터 검색**: MongoDB 메모리 내 코사인 유사도 계산 방식 사용 (Atlas Vector Search는 현재 미사용)

## 문제 해결

**Q: 새로 생성한 문서에 임베딩이 생성되지 않아요.**
A: `npm run generate-styleguide-embeddings` 실행하여 새 문서에 임베딩 생성

**Q: 벡터 검색 결과가 나오지 않아요.**
A: 임베딩 존재 여부 확인 및 최소 유사도 점수(`minScore`) 낮추기 (기본값 0.6)

**Q: Claude API 응답이 파싱되지 않아요.**
A: `responseParser.js`의 다양한 파싱 전략 활용 중 문제 발생 시 로그 확인하여 대응
