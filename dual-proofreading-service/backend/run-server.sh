#!/bin/bash

# 색상 정의
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 로그 출력 함수
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 현재 디렉토리 확인
if [ ! -f "package.json" ]; then
    log_error "package.json을 찾을 수 없습니다. backend 디렉토리에서 이 스크립트를 실행하세요."
    exit 1
fi

# 종속성 설치
log_info "필요한 패키지를 설치합니다..."
npm install

# 필수 패키지 확인 및 설치
log_info "필수 패키지를 확인합니다..."
if ! grep -q '"dotenv"' package.json; then
    log_warning "dotenv 패키지가 설치되어 있지 않습니다. 설치합니다..."
    npm install dotenv
fi

if ! grep -q '"express"' package.json; then
    log_warning "express 패키지가 설치되어 있지 않습니다. 설치합니다..."
    npm install express
fi

if ! grep -q '"mongoose"' package.json; then
    log_warning "mongoose 패키지가 설치되어 있지 않습니다. 설치합니다..."
    npm install mongoose
fi

if ! grep -q '"cors"' package.json; then
    log_warning "cors 패키지가 설치되어 있지 않습니다. 설치합니다..."
    npm install cors
fi

# 필요한 디렉토리 및 파일 확인
log_info "필요한 디렉토리와 파일을 확인합니다..."

# config 디렉토리 확인 및 생성
if [ ! -d "src/config" ]; then
    log_warning "config 디렉토리가 없습니다. 생성합니다..."
    mkdir -p src/config
fi

# config 파일 확인 및 생성
if [ ! -f "src/config/index.js" ]; then
    log_warning "config/index.js 파일이 없습니다. 생성합니다..."
    cat > src/config/index.js << 'EOL'
// src/config/index.js
require('dotenv').config();

module.exports = {
  // 데이터베이스 설정
  MONGODB_URI: process.env.MONGODB_URI,
  
  // 서버 설정
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  // CORS 설정
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  
  // 로깅 설정
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  
  // 인증 설정
  JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '1d',
  
  // LLM 설정
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  
  // 임베딩 설정
  EMBEDDING_MODEL: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
  EMBEDDING_DIMENSION: parseInt(process.env.EMBEDDING_DIMENSION || '1536', 10),
  
  // 기타 설정
  MAX_TEXT_LENGTH: parseInt(process.env.MAX_TEXT_LENGTH || '10000', 10),
  DEFAULT_PROMPT_TEMPLATE: process.env.DEFAULT_PROMPT_TEMPLATE || 'standard',
};
EOL
fi

# utils 디렉토리와 logger 확인
if [ ! -d "src/utils" ]; then
    log_warning "utils 디렉토리가 없습니다. 생성합니다..."
    mkdir -p src/utils
fi

# logger 파일 확인 및 생성
if [ ! -f "src/utils/logger.js" ]; then
    log_warning "utils/logger.js 파일이 없습니다. 생성합니다..."
    cat > src/utils/logger.js << 'EOL'
// src/utils/logger.js
const config = require('../config');

const logger = {
  info: (message) => {
    if (config.NODE_ENV !== 'test') {
      console.log(`[INFO] ${message}`);
    }
  },
  error: (message) => {
    if (config.NODE_ENV !== 'test') {
      console.error(`[ERROR] ${message}`);
    }
  },
  warn: (message) => {
    if (config.NODE_ENV !== 'test') {
      console.warn(`[WARN] ${message}`);
    }
  },
  debug: (message) => {
    if (config.NODE_ENV === 'development') {
      console.debug(`[DEBUG] ${message}`);
    }
  }
};

module.exports = logger;
EOL
fi

# nodemon 글로벌 설치 여부 확인
if ! command -v nodemon &> /dev/null; then
    log_warning "nodemon이 설치되어 있지 않습니다. 글로벌로 설치합니다..."
    npm install -g nodemon || {
        log_warning "글로벌 설치 실패. npx를 사용해 실행합니다."
        USE_NPX=true
    }
fi

# MongoDB 설치 안내
log_info "MongoDB가 실행 중인지 확인하세요."
log_info "MongoDB가 설치되어 있지 않은 경우:"
log_info "  macOS: brew tap mongodb/brew && brew install mongodb-community && brew services start mongodb-community"
log_info "  Docker: docker run -d -p 27017:27017 --name mongodb mongo:latest"

# 환경 변수 파일 확인
if [ ! -f ".env" ]; then
    log_warning ".env 파일이 없습니다. 기본 설정으로 생성합니다."
    echo "MONGODB_URI=mongodb://localhost:27017/proofreading" > .env
    echo "PORT=3000" >> .env
    echo "NODE_ENV=development" >> .env
else
    log_info "기존 .env 파일을 사용합니다."
    if ! grep -q "MONGODB_URI" .env; then
        log_warning ".env 파일에 MONGODB_URI가 없습니다. 추가합니다."
        echo "MONGODB_URI=mongodb://localhost:27017/proofreading" >> .env
    fi
fi

# 환경변수가 제대로 로드되는지 확인
log_info "환경 변수를 확인합니다..."
if [ -z "$MONGODB_URI" ]; then
    log_warning "환경 변수가 로드되지 않았습니다. dotenv가 제대로 작동하는지 확인하세요."
fi

# 서버 실행
log_info "서버를 시작합니다..."
if [ "$USE_NPX" = true ]; then
    export DOTENV_CONFIG_PATH="$(pwd)/.env"
    npx nodemon src/app.js
else
    export DOTENV_CONFIG_PATH="$(pwd)/.env"
    nodemon src/app.js
fi 