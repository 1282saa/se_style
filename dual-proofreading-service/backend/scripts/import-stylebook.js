require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const styleGuideService = require("../src/services/styleGuideService");
const logger = require("../src/utils/logger");

// 연결 확인
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    logger.info(`MongoDB에 연결되었습니다: ${process.env.MONGODB_URI}`);
    return true;
  } catch (error) {
    logger.error(`MongoDB 연결 오류: ${error.message}`);
    return false;
  }
}

// 스타일북 데이터 가져오기
async function importStyleBook() {
  try {
    const connected = await connectDB();
    if (!connected) {
      process.exit(1);
    }

    // 샘플 스타일북 데이터 생성
    const sampleData = [
      {
        section: "맞춤법",
        content:
          '"방증"은 주변상황을 밝힘으로써 간접적 증명에 도움을 주는 것이고, "반증"은 반대되는 증거를 들어 증명하는 것입니다.',
        category: "표현 비교",
        tags: ["혼동표현", "유사단어"],
        priority: 4,
      },
      {
        section: "맞춤법",
        content:
          '"과반수"는 반을 넘은 수를 의미하므로, "과반수 이상"은 틀린 표현입니다.',
        category: "표현 비교",
        tags: ["혼동표현", "중복표현"],
        priority: 4,
      },
      {
        section: "맞춤법",
        content: '"까무러치다"가 맞고 "까무라치다"는 틀린 표현입니다.',
        category: "옳은 표현",
        tags: ["발음", "표기법"],
        priority: 5,
      },
      {
        section: "문장 구성",
        content:
          "한 건의 기사에서는 한 가지 주제만을 다뤄야 합니다(1기사 1주제).",
        category: "기본 원칙",
        tags: ["기사작성", "원칙"],
        priority: 3,
      },
      {
        section: "문장 구성",
        content: "하나의 문장에는 한 가지 사실만 전달하세요(1문장 1정보).",
        category: "문장 작성",
        tags: ["기사작성", "원칙"],
        priority: 3,
      },
      {
        section: "문장 구성",
        content:
          "리드는 기사 내용 가운데 가장 중요한 핵심을 간결하게 전달하는 역할을 합니다.",
        category: "리드 작성",
        tags: ["기사작성", "원칙"],
        priority: 3,
      },
      {
        section: "띄어쓰기",
        content:
          '의존 명사는 앞말과 띄어 씁니다. 예: "할 수 있다", "갈 때", "먹은 적이 있다"',
        category: "문법",
        tags: ["띄어쓰기", "의존명사"],
        priority: 4,
      },
      {
        section: "문체",
        content:
          "기사는 간결하고 명확한 문장으로 작성합니다. 장황한 표현과 불필요한 수식어는 피합니다.",
        category: "문장 작성",
        tags: ["문체", "간결성"],
        priority: 3,
      },
    ];

    // 스타일북 데이터 가져오기
    const result = await styleGuideService.importStyleBook(sampleData);
    logger.info(`스타일북 가져오기 결과: ${JSON.stringify(result)}`);

    await mongoose.connection.close();
    logger.info("MongoDB 연결 종료");

    return result;
  } catch (error) {
    logger.error(`스타일북 가져오기 오류: ${error.message}`);
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
}

// 실행
importStyleBook()
  .then((result) => {
    console.log("스타일북 가져오기 완료:", result);
    process.exit(0);
  })
  .catch((error) => {
    console.error("스타일북 가져오기 실패:", error);
    process.exit(1);
  });
