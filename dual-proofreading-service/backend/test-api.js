// test-api.js
const axios = require("axios");

// 테스트할 텍스트 샘플
const testCases = [
  {
    name: "맞춤법 오류 테스트",
    text: "안녕하세요, 오늘은 방증하기 위해 문장을 쓴 것이에요. 과반수 이상이 찬성했다고 합니다.",
  },
  {
    name: "외래어 표기 테스트",
    text: "구글과 마이크로소프트는 AI 개발에 힘쓰고 있습니다. 페이스북역시 AI 기술 발전에 투자하고 있지요.",
  },
  {
    name: "문체/표현 개선 테스트",
    text: "이 기업은 매출이 증가했다. 하지만 순이익은 감소했다. 왜냐하면 비용이 더 많이 발생했기 때문이다.",
  },
];

// API 호출 함수
async function callProofreadAPI(text) {
  try {
    console.log("API 호출 시도 중...");
    const response = await axios.post(
      "http://localhost:3003/api/articles/quick-proofread",
      {
        text,
        userId: "test-user",
        metadata: { source: "api-test" },
      },
      {
        timeout: 5000, // 5초 타임아웃 설정
      }
    );

    return response.data;
  } catch (error) {
    console.error("API 호출 오류:", error.message);
    if (error.response) {
      console.error("서버 응답:", error.response.data);
    } else if (error.code === "ECONNREFUSED") {
      console.error(
        "서버에 연결할 수 없습니다. 서버가 실행 중인지 확인하세요."
      );
    }
    return null;
  }
}

// 테스트 실행
async function runTests() {
  console.log("===== 교정 API 테스트 시작 =====");

  for (const testCase of testCases) {
    console.log(`\n--- ${testCase.name} ---`);
    console.log("원문:", testCase.text);

    const result = await callProofreadAPI(testCase.text);

    if (result && result.success) {
      console.log("\n● 최소 교정 결과:");
      console.log(result.data.correction1.text);

      console.log("\n● 적극적 교정 결과:");
      console.log(result.data.correction2.text);

      // 변경 사항 비교
      console.log("\n● 차이점:");
      if (result.data.correction1.text === testCase.text) {
        console.log("  - 최소 교정: 변경 없음");
      } else {
        console.log("  - 최소 교정: 변경 있음");
      }

      if (result.data.correction2.text === testCase.text) {
        console.log("  - 적극적 교정: 변경 없음");
      } else {
        console.log("  - 적극적 교정: 변경 있음");
      }

      if (result.data.correction1.text === result.data.correction2.text) {
        console.log("  * 두 교정 결과가 동일합니다.");
      } else {
        console.log("  * 두 교정 결과가 다릅니다.");
      }
    } else {
      console.log("테스트 실패: 서버 응답이 없거나 오류가 발생했습니다.");
    }

    console.log("\n-------------------------------");
  }

  console.log("\n===== 교정 API 테스트 완료 =====");
}

// 메인 함수
async function main() {
  try {
    // 서버 연결 확인
    try {
      console.log("서버 상태 확인 중...");
      await axios.get("http://localhost:3003/health", { timeout: 3000 });
      console.log("서버 상태: 정상");
    } catch (error) {
      console.error("서버 연결 오류:", error.message);
      console.error(
        "\n서버가 실행 중인지 확인하세요. 다음 명령으로 서버를 시작할 수 있습니다:"
      );
      console.error("node src/app.js");
      console.error(
        "\n그래도 테스트를 진행하시겠습니까? (실패할 가능성이 높습니다)"
      );
      // 서버 오류와 상관없이 테스트 진행
      console.log("테스트를 진행합니다...");
    }

    // API 테스트 실행
    await runTests();
  } catch (error) {
    console.error("테스트 실행 오류:", error.message);
  }
}

// 실행
main();
