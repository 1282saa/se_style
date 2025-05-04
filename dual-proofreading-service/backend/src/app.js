// src/app.js
// --------------------------------------------------
// Express 진입점 – 보안·로깅·에러·종료 처리까지 프로덕션 수준으로 강화

/* 0. 환경변수 로드 ------------------------------------------------ */
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

/* 1. 외부 의존성 -------------------------------------------------- */
require("express-async-errors"); // 비동기 에러 자동 전달
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const { v4: uuid } = require("uuid");

/* 2. 내부 모듈 ---------------------------------------------------- */
const config = require("./config");
const routes = require("./routes");
const logger = require("./utils/logger");
const errorMiddleware = require("./utils/errorMiddleware"); // AppError 핸들러

/* 3. 앱 인스턴스 -------------------------------------------------- */
const app = express();
app.set("trust proxy", 1); // 로드밸런서 뒤 IP·HTTPS 인식

/* 4. 보안·성능 미들웨어 ------------------------------------------ */
app.use(helmet());
app.use(compression());
app.use(
  rateLimit({
    windowMs: 60 * 1000, // 1분
    max: config.RATE_LIMIT_MAX || 120, // IP당 120 req/분
    standardHeaders: true,
    legacyHeaders: false,
  })
);

/* 5. 파서 -------------------------------------------------------- */
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

/* 6. CORS -------------------------------------------------------- */
app.use(
  cors({
    origin: (origin, cb) => {
      const regex = new RegExp(
        process.env.CORS_ORIGIN || "^http://localhost:\\d+$"
      );
      cb(null, !origin || regex.test(origin));
    },
    credentials: true,
  })
);

/* 7. request-id & 고급 로깅 -------------------------------------- */
app.use((req, res, next) => {
  req.id = uuid();
  const started = Date.now();
  res.on("finish", () => {
    logger.info(
      `[${req.id}] ${req.ip} ${req.method} ${req.originalUrl} ` +
        `${res.statusCode} ${Date.now() - started}ms`
    );
  });
  next();
});

/* 8. 헬스체크 ---------------------------------------------------- */
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", time: new Date().toISOString() });
});

/* 9. 라우트 ------------------------------------------------------ */
app.use(routes);

/* 10. 404 ------------------------------------------------------- */
app.use((req, res) =>
  res.status(404).json({ success: false, message: "리소스를 찾을 수 없습니다" })
);

/* 11. 에러 미들웨어 --------------------------------------------- */
app.use(errorMiddleware); // utils/errorMiddleware.js

/* 12. DB 연결 ---------------------------------------------------- */
const connectDB = async () => {
  try {
    await mongoose.connect(config.MONGODB_URI, {
      autoIndex: false,
      maxPoolSize: 10,
    });
    logger.info("MongoDB 연결 완료");
  } catch (err) {
    logger.error(`DB 연결 실패: ${err.message}`);
    process.exit(1);
  }
};

/* 13. 서버 기동 -------------------------------------------------- */
let server; // graceful shutdown 용
const startServer = async () => {
  await connectDB();
  const PORT = config.PORT || 3003;
  server = app.listen(PORT, () =>
    logger.info(`🚀 Server @ http://localhost:${PORT} (${config.NODE_ENV})`)
  );
};
if (require.main === module) startServer();

/* 14. 종료 신호 처리 ------------------------------------------- */
const graceful = () => {
  logger.info("⏼  종료 시그널 수신, 서버 정리 중…");
  server?.close(() => {
    logger.info("HTTP 서버 종료");
    mongoose.connection.close(false, () => {
      logger.info("MongoDB 연결 종료");
      process.exit(0);
    });
  });
};
process.on("SIGINT", graceful);
process.on("SIGTERM", graceful);

/* 15. 모듈 export ---------------------------------------------- */
module.exports = app;
