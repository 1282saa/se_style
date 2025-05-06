/**
 * src/services/rag/ragService.js
 * RAG(Retrieval-Augmented Generation) 서비스
 *
 * 벡터 검색, 문서 검색, 조건부 처리 로직 등을 통합하여 교열 프롬프트에
 * 관련 스타일 가이드를 검색/통합하는 서비스
 */

const logger = require("../../utils/logger");
const vectorSearch = require("./vectorSearch");
const embeddingProvider = require("./embeddingProvider");
const config = require("../../config");
const Styleguide = require("../../models/styleguide.model");

/**
 * RAG 서비스
 */
class RagService {
  constructor() {
    this.defaultLimit = config.RAG_DEFAULT_LIMIT || 5;
    this.minScore = config.RAG_MIN_SCORE || 0.6;
    this.maxGuideTokens = config.RAG_MAX_GUIDE_TOKENS || 2000;
    this.maxSectionsPerCategory = config.RAG_MAX_SECTIONS_PER_CATEGORY || 3;
  }

  /**
   * 쿼리 텍스트와 관련된 스타일 가이드를 검색
   * @param {string} queryText - 검색 쿼리 텍스트
   * @param {Object} options - 검색 옵션
   * @returns {Promise<Array|Object>} - 검색된 스타일 가이드
   */
  async findRelevantGuides(queryText, options = {}) {
    try {
      if (
        !queryText ||
        typeof queryText !== "string" ||
        queryText.trim() === ""
      ) {
        logger.warn("유효하지 않은 쿼리 텍스트로 가이드 검색 시도");
        return [];
      }

      // 쿼리 분석
      const searchStrategy = await this.analyzeQuery(queryText, options);

      // 임베딩 생성
      const embedding = await embeddingProvider.createEmbedding(queryText);
      if (!embedding || embedding.length === 0) {
        logger.error("임베딩 생성 실패, 키워드 검색으로 대체");
        return await this.fallbackKeywordSearch(queryText, options);
      }

      // 검색 옵션 준비
      const searchOptions = this.#prepareSearchOptions(options);

      // 전략에 따른 검색 실행
      let results;
      switch (searchStrategy) {
        case "hierarchical":
          results = await vectorSearch.findHierarchical(embedding, {
            ...searchOptions,
            useHierarchical: true,
            includeChunks: options.includeChunks !== false,
          });
          break;

        case "docType":
          results = await vectorSearch.findByDocType(
            embedding,
            options.docTypes || "rule",
            searchOptions
          );
          break;

        case "category":
          results = await vectorSearch.findByCategory(embedding, {
            ...searchOptions,
            useCategories: true,
            includeChunks: options.includeChunks === true,
          });
          break;

        case "combined":
          results = await this.combinedSearch(
            embedding,
            queryText,
            searchOptions
          );
          break;

        default: // 기본 검색
          results = await vectorSearch.searchByVector(
            Styleguide,
            embedding,
            searchOptions
          );
          break;
      }

      logger.info(`RAG 검색 완료 (전략: ${searchStrategy})`);
      return results;
    } catch (error) {
      logger.error(`RAG 가이드 검색 오류: ${error.message}`);
      return await this.fallbackKeywordSearch(queryText, options);
    }
  }

  /**
   * 주어진 프롬프트에 관련 스타일 가이드를 통합
   * @param {string} prompt - 기본 프롬프트
   * @param {string} queryText - 검색 쿼리 텍스트
   * @param {Object} options - 통합 옵션
   * @returns {Promise<string>} - 강화된 프롬프트
   */
  async enhancePromptWithRAG(prompt, queryText, options = {}) {
    try {
      if (!prompt || !queryText) {
        logger.warn("프롬프트 또는 쿼리 텍스트가 비어 있습니다");
        return prompt;
      }

      // 관련 가이드 검색
      const guides = await this.findRelevantGuides(queryText, options);
      if (!guides || (Array.isArray(guides) && guides.length === 0)) {
        logger.info("관련 가이드가 없어 기본 프롬프트 사용");
        return prompt;
      }

      // 프롬프트에 가이드 통합
      const enhancedPrompt = await this.integratePrimitivePrompt(
        prompt,
        guides,
        options
      );
      return enhancedPrompt;
    } catch (error) {
      logger.error(`프롬프트 RAG 강화 오류: ${error.message}`);
      return prompt; // 오류 시 원본 프롬프트 반환
    }
  }

  /**
   * 쿼리 텍스트 분석하여 최적의 검색 전략 결정
   * @param {string} queryText - 분석할 쿼리 텍스트
   * @param {Object} options - 분석 옵션
   * @returns {Promise<string>} - 결정된 검색 전략
   */
  async analyzeQuery(queryText, options = {}) {
    // 사용자가 명시적으로 전략 지정한 경우
    if (options.strategy) {
      return options.strategy;
    }

    // 문서 유형 명시적 지정 시
    if (options.docTypes) {
      return "docType";
    }

    // 카테고리 기반 검색 요청 시
    if (options.useCategories) {
      return "category";
    }

    // 계층적 검색 요청 시
    if (options.useHierarchical) {
      return "hierarchical";
    }

    // 쿼리 길이에 따른 전략 선택
    const queryLength = queryText.length;
    if (queryLength > 500) {
      // 긴 텍스트일 경우, 계층적 검색 선택
      return "hierarchical";
    } else if (queryLength > 100) {
      // 중간 길이 텍스트, 기본 검색과 계층 결합
      return "combined";
    }

    // 짧은 쿼리는 기본 검색 사용
    return "default";
  }

  /**
   * 키워드 기반 대체 검색 (임베딩 실패 시)
   * @param {string} queryText - 검색 쿼리
   * @param {Object} options - 검색 옵션
   * @returns {Promise<Array>} - 검색 결과
   */
  async fallbackKeywordSearch(queryText, options = {}) {
    try {
      // 키워드 추출
      const keywords = queryText
        .split(/\s+/)
        .filter((word) => word.length > 1)
        .slice(0, 10);

      if (keywords.length === 0) {
        return [];
      }

      // 키워드 검색 수행
      const results = await vectorSearch.keywordSearch(
        keywords,
        options.limit || this.defaultLimit
      );

      logger.info(`대체 키워드 검색 완료: ${results.length}개 결과`);
      return results;
    } catch (error) {
      logger.error(`대체 키워드 검색 오류: ${error.message}`);
      return [];
    }
  }

  /**
   * 여러 검색 전략 결과를 조합한 통합 검색
   * @param {Array<number>} embedding - 쿼리 임베딩
   * @param {string} queryText - 원본 쿼리 텍스트
   * @param {Object} options - 검색 옵션
   * @returns {Promise<Array>} - 통합 검색 결과
   */
  async combinedSearch(embedding, queryText, options = {}) {
    try {
      // 1. 기본 검색
      const defaultResults = await vectorSearch.searchByVector(
        Styleguide,
        embedding,
        {
          ...options,
          limit: Math.ceil(options.limit / 2) || 3,
        }
      );

      // 2. 계층적 검색
      const { documents, chunks } = await vectorSearch.findHierarchical(
        embedding,
        {
          ...options,
          limit: Math.ceil(options.limit / 2) || 3,
          includeChunks: true,
        }
      );

      // 3. 결과 통합 및 중복 제거
      const combinedResults = this.mergeAndDeduplicateResults(
        defaultResults,
        [...documents, ...chunks],
        options.scoreField || "score"
      );

      // 가장 관련성 높은 결과 상위 N개 추출
      const finalResults = combinedResults
        .sort(
          (a, b) =>
            b[options.scoreField || "score"] - a[options.scoreField || "score"]
        )
        .slice(0, options.limit || this.defaultLimit);

      logger.info(`통합 검색 완료: ${finalResults.length}개 결과`);
      return finalResults;
    } catch (error) {
      logger.error(`통합 검색 오류: ${error.message}`);
      return [];
    }
  }

  /**
   * 여러 검색 결과 배열을 병합하고 중복 제거
   * @param {Array} results1 - 첫 번째 결과 배열
   * @param {Array} results2 - 두 번째 결과 배열
   * @param {string} scoreField - 점수 필드명
   * @returns {Array} - 병합된 결과
   */
  mergeAndDeduplicateResults(
    results1 = [],
    results2 = [],
    scoreField = "score"
  ) {
    // 두 배열 통합
    const allResults = [...results1, ...results2];

    // 이미 처리된 ID 추적
    const processedIds = new Set();

    // 중복 제거된 결과
    const uniqueResults = [];

    for (const result of allResults) {
      // ID가 없거나 이미 처리된 경우 스킵
      const resultId = result._id?.toString() || result.ruleId;
      if (!resultId || processedIds.has(resultId)) {
        continue;
      }

      // 처리된 ID 표시
      processedIds.add(resultId);

      // 최종 결과에 추가
      uniqueResults.push(result);
    }

    return uniqueResults;
  }

  /**
   * 기본 프롬프트에 검색된 가이드 통합
   * @param {string} prompt - 기본 프롬프트
   * @param {Array|Object} guides - 검색된 가이드
   * @param {Object} options - 통합 옵션
   * @returns {string} - 강화된 프롬프트
   */
  async integratePrimitivePrompt(prompt, guides, options = {}) {
    try {
      // RAG 섹션 추가 위치 확인 (기본값: 프롬프트 끝)
      const insertPoint = options.insertPoint || "end";
      const maxTokens = options.maxTokens || this.maxGuideTokens;

      // 가이드 형식화
      let formattedGuides = "";

      // 계층 또는 카테고리 구조화된 결과인 경우
      if (!Array.isArray(guides) && guides.categories) {
        formattedGuides = this.formatCategorizedGuides(
          guides.categories,
          maxTokens
        );
      }
      // 계층 구조인 경우
      else if (!Array.isArray(guides) && guides.documents) {
        formattedGuides = this.formatHierarchicalGuides(guides, maxTokens);
      }
      // 일반 배열인 경우
      else if (Array.isArray(guides)) {
        formattedGuides = this.formatSimpleGuides(guides, maxTokens);
      }

      // 형식화된 가이드가 없으면 원본 프롬프트 반환
      if (!formattedGuides || formattedGuides.trim() === "") {
        return prompt;
      }

      // RAG 섹션 생성
      const ragSection = `\n\n### 관련 스타일 가이드\n${formattedGuides}\n\n`;

      // 삽입 위치에 따라 프롬프트에 통합
      let enhancedPrompt;
      switch (insertPoint) {
        case "beginning":
          enhancedPrompt = ragSection + prompt;
          break;

        case "beforeInstructions":
          if (prompt.includes("### 교열 지시사항")) {
            enhancedPrompt = prompt.replace(
              "### 교열 지시사항",
              ragSection + "### 교열 지시사항"
            );
          } else {
            enhancedPrompt = ragSection + prompt;
          }
          break;

        case "afterInstructions":
          if (prompt.includes("### 교열 지시사항")) {
            const parts = prompt.split("### 교열 지시사항");
            const instructionSection = parts[1].split(/(?=###)/)[0];
            enhancedPrompt =
              parts[0] +
              "### 교열 지시사항" +
              instructionSection +
              ragSection +
              parts[1].substring(instructionSection.length);
          } else {
            enhancedPrompt = prompt + ragSection;
          }
          break;

        case "end":
        default:
          enhancedPrompt = prompt + ragSection;
          break;
      }

      return enhancedPrompt;
    } catch (error) {
      logger.error(`프롬프트 통합 오류: ${error.message}`);
      return prompt;
    }
  }

  /**
   * 단순 가이드 배열 형식화
   * @param {Array} guides - 가이드 배열
   * @param {number} maxTokens - 최대 토큰 수
   * @returns {string} - 형식화된 가이드
   */
  formatSimpleGuides(guides, maxTokens = 2000) {
    if (!guides || !Array.isArray(guides) || guides.length === 0) {
      return "";
    }

    let result = "";
    let estimatedTokens = 0;
    const tokensPerChar = 0.6; // 한글 기준 글자당 대략 0.6토큰

    for (const guide of guides) {
      if (!guide) continue;

      // 가이드 정보 추출
      const category = guide.category || "일반";
      const section = guide.section || "규칙";
      const content = guide.content || "";
      const priority = guide.priority || 3;

      // 해당 가이드 형식화
      const formattedGuide = `- [${category}] ${section}\n${content}\n(우선순위: ${priority}/5)\n\n`;

      // 토큰 수 추정
      const guideTokens = Math.ceil(formattedGuide.length * tokensPerChar);

      // 최대 토큰 초과 시 중단
      if (estimatedTokens + guideTokens > maxTokens) {
        break;
      }

      // 결과에 추가
      result += formattedGuide;
      estimatedTokens += guideTokens;
    }

    return result;
  }

  /**
   * 계층 구조 가이드 형식화
   * @param {Object} hierarchical - 계층 구조 가이드
   * @param {number} maxTokens - 최대 토큰 수
   * @returns {string} - 형식화된 가이드
   */
  formatHierarchicalGuides(hierarchical, maxTokens = 2000) {
    if (
      !hierarchical ||
      !hierarchical.documents ||
      hierarchical.documents.length === 0
    ) {
      return "";
    }

    // 먼저 상위 문서 형식화
    const documentsContent = this.formatSimpleGuides(
      hierarchical.documents,
      maxTokens * 0.7
    );

    // 추정 토큰 계산
    const tokensPerChar = 0.6;
    const documentsTokens = Math.ceil(documentsContent.length * tokensPerChar);
    const remainingTokens = maxTokens - documentsTokens;

    // 청크 형식화 (남은 토큰 내에서)
    let chunksContent = "";
    if (
      hierarchical.chunks &&
      hierarchical.chunks.length > 0 &&
      remainingTokens > 0
    ) {
      chunksContent =
        "\n### 관련 구문\n" +
        this.formatSimpleGuides(hierarchical.chunks, remainingTokens);
    }

    return documentsContent + chunksContent;
  }

  /**
   * 카테고리별 그룹화된 가이드 형식화
   * @param {Object} categories - 카테고리별 가이드
   * @param {number} maxTokens - 최대 토큰 수
   * @returns {string} - 형식화된 가이드
   */
  formatCategorizedGuides(categories, maxTokens = 2000) {
    if (!categories || Object.keys(categories).length === 0) {
      return "";
    }

    let result = "";
    let estimatedTokens = 0;
    const tokensPerChar = 0.6;
    const maxSectionsPerCategory = this.maxSectionsPerCategory;

    // 카테고리별 처리
    for (const [category, guides] of Object.entries(categories)) {
      if (!guides || guides.length === 0) continue;

      // 카테고리 헤더 추가
      const categoryHeader = `\n#### ${category}\n`;
      result += categoryHeader;
      estimatedTokens += Math.ceil(categoryHeader.length * tokensPerChar);

      // 카테고리별 최대 섹션 수 제한
      const limitedGuides = guides.slice(0, maxSectionsPerCategory);

      // 가이드 형식화
      for (const guide of limitedGuides) {
        if (!guide) continue;

        const section = guide.section || "규칙";
        const content = guide.content || "";
        const priority = guide.priority || 3;

        const formattedGuide = `- ${section}\n${content}\n(우선순위: ${priority}/5)\n\n`;
        const guideTokens = Math.ceil(formattedGuide.length * tokensPerChar);

        // 최대 토큰 초과 시 중단
        if (estimatedTokens + guideTokens > maxTokens) {
          result += "(추가 항목 생략...)\n";
          break;
        }

        // 결과에 추가
        result += formattedGuide;
        estimatedTokens += guideTokens;
      }

      // 최대 토큰 초과 시 카테고리 순회 중단
      if (estimatedTokens >= maxTokens) {
        result += "(추가 카테고리 생략...)\n";
        break;
      }
    }

    return result;
  }

  /**
   * RAG 향상된 프롬프트 작성
   * @param {string} baseTemplate - 기본 프롬프트 템플릿
   * @param {string} text - 교열할 텍스트
   * @param {Object} options - 프롬프트 옵션
   * @returns {Promise<string>} - RAG 강화 프롬프트
   */
  async buildRagPrompt(baseTemplate, text, options = {}) {
    try {
      if (!baseTemplate || !text) {
        logger.warn("템플릿 또는 텍스트가 비어 있습니다");
        return baseTemplate;
      }

      // 기본 프롬프트 생성 (텍스트 포함)
      let prompt = baseTemplate;

      // 텍스트 자리 표시자 교체
      if (prompt.includes("{{TEXT}}")) {
        prompt = prompt.replace("{{TEXT}}", text);
      } else {
        // 자리 표시자가 없으면 끝에 추가
        prompt += `\n\n### 교열할 텍스트\n${text}`;
      }

      // RAG로 프롬프트 강화
      const ragPrompt = await this.enhancePromptWithRAG(prompt, text, options);

      return ragPrompt;
    } catch (error) {
      logger.error(`RAG 프롬프트 생성 오류: ${error.message}`);
      return baseTemplate.replace("{{TEXT}}", text); // 오류 시 기본 프롬프트 반환
    }
  }

  /**
   * 검색 옵션 준비
   * @param {Object} options - 사용자 지정 옵션
   * @returns {Object} - 준비된 검색 옵션
   */
  #prepareSearchOptions(options = {}) {
    return {
      limit: options.limit || this.defaultLimit,
      minScore: options.minScore || this.minScore,
      filter: {
        isActive: options.includeInactive ? undefined : true,
        ...(options.filter || {}),
      },
      scoreField: options.scoreField || "score",
    };
  }
}

module.exports = new RagService();
