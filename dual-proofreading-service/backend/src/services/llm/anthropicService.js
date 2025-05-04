const axios = require("axios");
const config = require("../../config");
const logger = require("../../utils/logger");

/**
 * Anthropic Claude API 서비스
 */
class AnthropicService {
  constructor() {
    this.apiKey = config.ANTHROPIC_API_KEY;
    this.baseUrl = "https://api.anthropic.com";
    this.model = "claude-3-opus-20240229"; // 또는 다른 Claude 모델
  }

  /**
   * API 키 검증
   * @private
   */
  #validateApiKey() {
    if (!this.apiKey) {
      throw new Error(
        "Anthropic API 키가 설정되지 않았습니다. .env 파일에 ANTHROPIC_API_KEY를 추가하세요."
      );
    }
  }

  /**
   * Claude API를 호출하여 응답 생성
   * @param {string} prompt - 프롬프트
   * @param {Object} options - 추가 옵션
   * @returns {Promise<Object>} - API 응답
   */
  async generateCompletion(prompt, options = {}) {
    try {
      // API 키 확인
      this.#validateApiKey();

      logger.info("[AnthropicService] Claude API 호출 시작");

      /* 디버깅을 위해 모의 응답 사용 (실제 개발이 완료되면 아래 코드 주석 처리)
      // 프롬프트에서 교정 유형 추출
      const isMinimal = prompt.includes("필수적인 교정만 수행하세요");

      // 입력 텍스트에서 실제 콘텐츠 추출
      const extractedText = prompt
        .substring(prompt.indexOf("원문:") + 3)
        .trim();

      logger.info(
        `[AnthropicService] 입력 텍스트: ${extractedText.substring(0, 50)}...`
      );

      // 모의 응답 생성
      let correctedText = extractedText; // 기본적으로 원문 유지
      let corrections = [];

      // 교정 유형에 따른 수정 적용
      if (extractedText.includes("매출이 증가했다")) {
        correctedText = isMinimal
          ? "이 기업은 매출이 증가했다. 하지만 순이익은 감소했다. 왜냐하면 비용이 더 많이 발생했기 때문이다."
          : "이 기업은 매출이 증가했으나, 비용 증가로 인해 순이익은 감소했습니다.";

        corrections.push({
          type: "style",
          originalText:
            "이 기업은 매출이 증가했다. 하지만 순이익은 감소했다. 왜냐하면 비용이 더 많이 발생했기 때문이다.",
          correctedText:
            "이 기업은 매출이 증가했으나, 비용 증가로 인해 순이익은 감소했습니다.",
          explanation:
            "문장을 통합하여 간결하게 표현하고, 원인과 결과를 명확히 연결했습니다.",
        });
      }

      logger.info("[AnthropicService] 모의 응답 생성 완료");

      return {
        correctedText: correctedText,
        corrections: corrections,
      };
      */

      // 실제 API 호출 코드 (API 연동 문제 해결 후 활성화)
      logger.info("[AnthropicService] 실제 Claude API 호출 시도");
      logger.info(
        `[AnthropicService] API 키: ${this.apiKey ? "설정됨" : "설정되지 않음"}`
      );
      logger.info(`[AnthropicService] 프롬프트 길이: ${prompt.length}`);

      const response = await axios.post(
        `${this.baseUrl}/v1/messages`,
        {
          model: options.model || this.model,
          max_tokens: options.maxTokens || 4096,
          temperature: options.temperature || 0.7,
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
        },
        {
          headers: {
            "Content-Type": "application/json",
            "x-api-key": this.apiKey,
            "anthropic-version": "2023-06-01",
          },
        }
      );

      logger.info("[AnthropicService] Claude API 호출 완료");
      logger.info(`[AnthropicService] 응답 상태 코드: ${response.status}`);
      logger.info(
        `[AnthropicService] 응답 데이터: ${JSON.stringify(
          response.data
        ).substring(0, 200)}...`
      );

      // 응답에서 텍스트 추출
      const content = response.data.content || [];
      const textContent = content.find((item) => item.type === "text");
      const text = textContent ? textContent.text : "";

      logger.info(
        `[AnthropicService] 추출된 텍스트: ${text.substring(0, 200)}...`
      );

      try {
        // JSON 형식 응답 파싱 시도
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const jsonStr = jsonMatch[0];
          logger.info(
            `[AnthropicService] 추출된 JSON: ${jsonStr.substring(0, 200)}...`
          );

          try {
            const parsedResult = JSON.parse(jsonStr);
            logger.info("[AnthropicService] JSON 응답 파싱 성공");
            return parsedResult;
          } catch (jsonError) {
            logger.warn(
              `[AnthropicService] JSON 파싱 오류: ${jsonError.message}`
            );
            // JSON 파싱 실패 시 텍스트 자체를 correctedText로 반환
            return {
              correctedText: text,
              corrections: [],
            };
          }
        } else {
          logger.warn(
            "[AnthropicService] JSON 형식을 찾을 수 없음, 텍스트 그대로 반환"
          );
          return {
            correctedText: text,
            corrections: [],
          };
        }
      } catch (parseError) {
        logger.warn(
          `[AnthropicService] 응답 처리 중 오류 발생: ${parseError.message}`
        );
        return {
          correctedText: text,
          corrections: [],
        };
      }
    } catch (error) {
      logger.error(`[AnthropicService] Claude API 호출 오류: ${error.message}`);

      if (error.response) {
        logger.error(
          `[AnthropicService] Claude API 응답: ${JSON.stringify(
            error.response.data
          )}`
        );
      }

      throw new Error(`Claude API 호출 중 오류 발생: ${error.message}`);
    }
  }

  /**
   * 텍스트 교정
   * @param {string} prompt - 교정 프롬프트
   * @returns {Promise<Object>} - 교정 결과
   */
  async proofread(prompt) {
    return this.generateCompletion(prompt, {
      temperature: 0.3, // 교정에는 낮은 temperature 사용
    });
  }

  /**
   * 임베딩 생성 (데모 구현)
   * @param {string} text - 임베딩할 텍스트
   * @returns {Promise<Object>} - 임베딩 결과
   */
  async generateEmbedding(text) {
    try {
      // this.#validateApiKey();

      logger.info("[AnthropicService] 임베딩 생성 시작");

      // 실제로는 OpenAI나 다른 임베딩 API를 사용해야 함
      // 여기서는 데모 목적으로 더미 임베딩 반환
      const dummyEmbedding = Array(1536)
        .fill(0)
        .map(() => Math.random() * 2 - 1);

      logger.info("[AnthropicService] 임베딩 생성 완료");

      return {
        embedding: dummyEmbedding,
        model: "dummy-embedding-model",
      };
    } catch (error) {
      logger.error(`[AnthropicService] 임베딩 생성 오류: ${error.message}`);
      throw new Error(`임베딩 생성 중 오류 발생: ${error.message}`);
    }
  }

  /**
   * 테스트용 모의 응답 생성
   * @private
   */
  #getMockResponse(type, isMinimal) {
    switch (type) {
      case "spelling":
        return isMinimal
          ? "안녕하세요, 오늘은 방증하기 위해 문장을 쓴 것이에요. 과반수가 찬성했다고 합니다."
          : "안녕하세요, 오늘은 방증하기 위해 문장을 작성했습니다. 과반수가 찬성했다고 합니다.";
      case "spacing":
        return isMinimal
          ? "구글과 마이크로소프트는 AI 개발에 힘쓰고 있습니다. 페이스북 역시 AI 기술 발전에 투자하고 있지요."
          : "구글과 마이크로소프트는 AI 개발에 힘쓰고 있습니다. 페이스북 역시 AI 기술 발전에 투자하고 있습니다.";
      case "style":
        return isMinimal
          ? "이 기업은 매출이 증가했다. 하지만 순이익은 감소했다. 왜냐하면 비용이 더 많이 발생했기 때문이다."
          : "이 기업은 매출이 증가했으나, 비용 증가로 인해 순이익은 감소했습니다.";
      default:
        return "교정된 텍스트입니다.";
    }
  }

  /**
   * 테스트용 모의 교정 사항 생성
   * @private
   */
  #getMockCorrections(prompt, isMinimal) {
    if (prompt.includes("과반수 이상")) {
      return [
        {
          type: "spelling",
          originalText: "과반수 이상",
          correctedText: "과반수",
          explanation:
            "'과반수'는 이미 '반이 넘는 수'를 의미하므로 '이상'은 중복 표현입니다.",
        },
      ];
    } else if (prompt.includes("페이스북역시")) {
      return [
        {
          type: "spacing",
          originalText: "페이스북역시",
          correctedText: "페이스북 역시",
          explanation: "'페이스북'과 '역시' 사이에 띄어쓰기가 필요합니다.",
        },
      ];
    } else if (prompt.includes("왜냐하면") && !isMinimal) {
      return [
        {
          type: "style",
          originalText:
            "이 기업은 매출이 증가했다. 하지만 순이익은 감소했다. 왜냐하면 비용이 더 많이 발생했기 때문이다.",
          correctedText:
            "이 기업은 매출이 증가했으나, 비용 증가로 인해 순이익은 감소했습니다.",
          explanation:
            "문장을 통합하여 간결하게 표현하고, 원인과 결과를 명확히 연결했습니다.",
        },
      ];
    } else {
      return [];
    }
  }
}

module.exports = new AnthropicService();
