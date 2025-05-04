# 맞춤형 교열 시스템 - 백엔드 서버

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

## 주의사항

- 서버 실행 전에 MongoDB가 실행 중인지 확인하세요.
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

### PowerShell 문제

PowerShell에서 실행 시 문제가 발생하면 기본 터미널(Terminal.app, iTerm 등)을 사용하여 명령을 실행하세요.
