// src/controllers/styleguide.controller.js
const Styleguide = require("../models/styleguide.model");
const styleGuideService = require("../services/styleGuideService");
const logger = require("../utils/logger");
const fs = require("fs").promises;
const path = require("path");
const config = require("../config");

/**
 * 스타일 가이드 목록을 조회합니다.
 * @async
 * @function getStyleguides
 * @param {Object} req - Express 요청 객체
 * @param {Object} req.query - 쿼리 매개변수
 * @param {string} [req.query.category] - 필터링할 카테고리
 * @param {string} [req.query.tag] - 필터링할 태그
 * @param {string} [req.query.section] - 필터링할 섹션 (부분 일치 검색)
 * @param {number} [req.query.page=1] - 페이지 번호
 * @param {number} [req.query.limit=20] - 페이지당 항목 수
 * @param {Object} res - Express 응답 객체
 * @returns {Object} 스타일 가이드 목록 및 페이지네이션 정보
 * @throws {Error} 스타일 가이드 목록 조회 중 발생한 오류
 */
const getStyleguides = async (req, res) => {
  try {
    const { category, tag, section, page = 1, limit = 20 } = req.query;

    // 쿼리 구성
    const query = {};

    if (category) {
      query.category = category;
    }

    if (tag) {
      query.tags = tag;
    }

    if (section) {
      query.section = { $regex: section, $options: "i" };
    }

    // 페이지네이션 설정
    const options = {
      skip: (page - 1) * limit,
      limit: parseInt(limit, 10),
      sort: { priority: -1, category: 1, section: 1 },
    };

    // 스타일 가이드 조회
    const styleguides = await Styleguide.find(query, null, options);
    const total = await Styleguide.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        styleguides,
        pagination: {
          total,
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    logger.error(`스타일 가이드 목록 조회 오류: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `스타일 가이드 목록 조회 중 오류가 발생했습니다: ${error.message}`,
    });
  }
};

/**
 * 특정 스타일 가이드를 조회합니다.
 * @async
 * @function getStyleguideById
 * @param {Object} req - Express 요청 객체
 * @param {Object} req.params - URL 매개변수
 * @param {string} req.params.id - 조회할 스타일 가이드 ID
 * @param {Object} res - Express 응답 객체
 * @returns {Object} 스타일 가이드 상세 정보
 * @throws {Error} 스타일 가이드 조회 중 발생한 오류
 */
const getStyleguideById = async (req, res) => {
  try {
    const { id } = req.params;

    const styleguide = await Styleguide.findById(id);
    if (!styleguide) {
      return res.status(404).json({
        success: false,
        message: "스타일 가이드를 찾을 수 없습니다.",
      });
    }

    res.status(200).json({
      success: true,
      data: styleguide,
    });
  } catch (error) {
    logger.error(`스타일 가이드 조회 오류: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `스타일 가이드 조회 중 오류가 발생했습니다: ${error.message}`,
    });
  }
};

/**
 * 특정 스타일 가이드와 관련된 스타일 가이드를 조회합니다.
 * @async
 * @function getRelatedStyleguides
 * @param {Object} req - Express 요청 객체
 * @param {Object} req.params - URL 매개변수
 * @param {string} req.params.id - 스타일 가이드 ID
 * @param {Object} req.query - 쿼리 매개변수
 * @param {number} [req.query.limit=5] - 결과 제한 수
 * @param {Object} res - Express 응답 객체
 * @returns {Object} 관련 스타일 가이드 목록
 * @throws {Error} 관련 스타일 가이드 조회 중 발생한 오류
 */
const getRelatedStyleguides = async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 5 } = req.query;

    // 기준 스타일 가이드 조회
    const styleguide = await Styleguide.findById(id);
    if (!styleguide) {
      return res.status(404).json({
        success: false,
        message: "스타일 가이드를 찾을 수 없습니다.",
      });
    }

    // 벡터 기반 유사 스타일 가이드 검색
    const relatedStyleguides = await styleGuideService.findRelatedStyleguides(
      styleguide.content,
      parseInt(limit, 10),
      id // 자기 자신 제외
    );

    res.status(200).json({
      success: true,
      data: {
        styleguideId: id,
        relatedStyleguides,
      },
    });
  } catch (error) {
    logger.error(`관련 스타일 가이드 조회 오류: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `관련 스타일 가이드 조회 중 오류가 발생했습니다: ${error.message}`,
    });
  }
};

/**
 * 모든 카테고리 목록을 조회합니다.
 * @async
 * @function getCategories
 * @param {Object} req - Express 요청 객체
 * @param {Object} res - Express 응답 객체
 * @returns {Object} 카테고리 목록
 * @throws {Error} 카테고리 목록 조회 중 발생한 오류
 */
const getCategories = async (req, res) => {
  try {
    const categories = await Styleguide.distinct("category");

    res.status(200).json({
      success: true,
      data: {
        categories,
      },
    });
  } catch (error) {
    logger.error(`카테고리 목록 조회 오류: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `카테고리 목록 조회 중 오류가 발생했습니다: ${error.message}`,
    });
  }
};

/**
 * 모든 태그 목록을 조회합니다.
 * @async
 * @function getTags
 * @param {Object} req - Express 요청 객체
 * @param {Object} res - Express 응답 객체
 * @returns {Object} 태그 목록
 * @throws {Error} 태그 목록 조회 중 발생한 오류
 */
const getTags = async (req, res) => {
  try {
    const tags = await Styleguide.distinct("tags");

    res.status(200).json({
      success: true,
      data: {
        tags,
      },
    });
  } catch (error) {
    logger.error(`태그 목록 조회 오류: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `태그 목록 조회 중 오류가 발생했습니다: ${error.message}`,
    });
  }
};

/**
 * 새 스타일 가이드를 생성합니다.
 * @async
 * @function createStyleguide
 * @param {Object} req - Express 요청 객체
 * @param {Object} req.body - 요청 바디
 * @param {string} req.body.section - 스타일 가이드 섹션
 * @param {string} req.body.content - 스타일 가이드 내용
 * @param {string} req.body.category - 스타일 가이드 카테고리
 * @param {Array<string>} [req.body.tags] - 스타일 가이드 태그
 * @param {number} [req.body.priority] - 스타일 가이드 우선순위
 * @param {Object} [req.body.metadata] - 스타일 가이드 메타데이터
 * @param {string} [req.body.version="1.0"] - 스타일 가이드 버전
 * @param {Object} res - Express 응답 객체
 * @returns {Object} 생성된 스타일 가이드 정보
 * @throws {Error} 스타일 가이드 생성 중 발생한 오류
 */
const createStyleguide = async (req, res) => {
  try {
    const styleguideData = {
      section: req.body.section,
      content: req.body.content,
      category: req.body.category,
      tags: req.body.tags,
      priority: req.body.priority,
      metadata: req.body.metadata,
      version: req.body.version || "1.0",
    };

    // 필수 필드 검증
    if (
      !styleguideData.section ||
      !styleguideData.content ||
      !styleguideData.category
    ) {
      return res.status(400).json({
        success: false,
        message: "section, content, category 필드는 필수입니다.",
      });
    }

    // 스타일 가이드 생성
    const styleguide = new Styleguide(styleguideData);
    const savedStyleguide = await styleguide.save();

    // 벡터 임베딩 생성 (비동기적으로 처리)
    styleGuideService
      .generateEmbedding(savedStyleguide._id)
      .catch((err) => logger.error(`벡터 임베딩 생성 오류: ${err.message}`));

    res.status(201).json({
      success: true,
      message: "스타일 가이드가 성공적으로 생성되었습니다",
      data: savedStyleguide,
    });
  } catch (error) {
    logger.error(`스타일 가이드 생성 오류: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `스타일 가이드 생성 중 오류가 발생했습니다: ${error.message}`,
    });
  }
};

/**
 * 스타일 가이드를 업데이트합니다.
 * @async
 * @function updateStyleguide
 * @param {Object} req - Express 요청 객체
 * @param {Object} req.params - URL 매개변수
 * @param {string} req.params.id - 업데이트할 스타일 가이드 ID
 * @param {Object} req.body - 요청 바디
 * @param {string} [req.body.section] - 스타일 가이드 섹션
 * @param {string} [req.body.content] - 스타일 가이드 내용
 * @param {string} [req.body.category] - 스타일 가이드 카테고리
 * @param {Array<string>} [req.body.tags] - 스타일 가이드 태그
 * @param {number} [req.body.priority] - 스타일 가이드 우선순위
 * @param {Object} [req.body.metadata] - 스타일 가이드 메타데이터
 * @param {string} [req.body.version] - 스타일 가이드 버전
 * @param {Object} res - Express 응답 객체
 * @returns {Object} 업데이트된 스타일 가이드 정보
 * @throws {Error} 스타일 가이드 업데이트 중 발생한 오류
 */
const updateStyleguide = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // ID로 스타일 가이드 조회
    const styleguide = await Styleguide.findById(id);
    if (!styleguide) {
      return res.status(404).json({
        success: false,
        message: "스타일 가이드를 찾을 수 없습니다.",
      });
    }

    // 업데이트 데이터 적용
    Object.keys(updateData).forEach((key) => {
      styleguide[key] = updateData[key];
    });

    // 업데이트된 스타일 가이드 저장
    const updatedStyleguide = await styleguide.save();

    // 컨텐츠가 변경되었다면 벡터 임베딩 재생성
    if (updateData.content) {
      styleGuideService
        .generateEmbedding(updatedStyleguide._id)
        .catch((err) =>
          logger.error(`벡터 임베딩 재생성 오류: ${err.message}`)
        );
    }

    res.status(200).json({
      success: true,
      message: "스타일 가이드가 성공적으로 업데이트되었습니다",
      data: updatedStyleguide,
    });
  } catch (error) {
    logger.error(`스타일 가이드 업데이트 오류: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `스타일 가이드 업데이트 중 오류가 발생했습니다: ${error.message}`,
    });
  }
};

/**
 * 스타일 가이드를 삭제합니다.
 * @async
 * @function deleteStyleguide
 * @param {Object} req - Express 요청 객체
 * @param {Object} req.params - URL 매개변수
 * @param {string} req.params.id - 삭제할 스타일 가이드 ID
 * @param {Object} res - Express 응답 객체
 * @returns {Object} 삭제 결과
 * @throws {Error} 스타일 가이드 삭제 중 발생한 오류
 */
const deleteStyleguide = async (req, res) => {
  try {
    const { id } = req.params;

    // ID로 스타일 가이드 조회 및 삭제
    const result = await Styleguide.findByIdAndDelete(id);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "스타일 가이드를 찾을 수 없습니다.",
      });
    }

    res.status(200).json({
      success: true,
      message: "스타일 가이드가 성공적으로 삭제되었습니다",
      data: { id },
    });
  } catch (error) {
    logger.error(`스타일 가이드 삭제 오류: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `스타일 가이드 삭제 중 오류가 발생했습니다: ${error.message}`,
    });
  }
};

/**
 * 스타일북 파일을 가져옵니다.
 * @async
 * @function importStylebook
 * @param {Object} req - Express 요청 객체
 * @param {Object} req.body - 요청 바디
 * @param {string} [req.body.filePath] - 스타일북 파일 경로
 * @param {Object} res - Express 응답 객체
 * @returns {Object} 가져오기 결과
 * @throws {Error} 스타일북 가져오기 중 발생한 오류
 */
const importStylebook = async (req, res) => {
  try {
    const { filePath } = req.body;
    const targetPath =
      filePath || path.join(config.STYLE_BOOK_DIR, "style-guide.json");

    // 파일 존재 여부 확인
    try {
      await fs.access(targetPath);
    } catch (error) {
      return res.status(404).json({
        success: false,
        message: `스타일북 파일을 찾을 수 없습니다: ${targetPath}`,
      });
    }

    // 파일 읽기
    const fileContent = await fs.readFile(targetPath, "utf8");
    let stylebookData;

    try {
      stylebookData = JSON.parse(fileContent);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: "스타일북 파일이 유효한 JSON 형식이 아닙니다.",
      });
    }

    // 스타일북 데이터 가져오기
    const result = await styleGuideService.importStylebook(stylebookData);

    res.status(200).json({
      success: true,
      message: "스타일북 가져오기가 완료되었습니다",
      data: result,
    });
  } catch (error) {
    logger.error(`스타일북 가져오기 오류: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `스타일북 가져오기 중 오류가 발생했습니다: ${error.message}`,
    });
  }
};

/**
 * 벡터 임베딩을 생성합니다.
 * @async
 * @function generateEmbeddings
 * @param {Object} req - Express 요청 객체
 * @param {Object} req.body - 요청 바디
 * @param {boolean} [req.body.all=false] - 모든 스타일 가이드의 임베딩을 재생성할지 여부
 * @param {Object} res - Express 응답 객체
 * @returns {Object} 임베딩 생성 결과
 * @throws {Error} 임베딩 생성 중 발생한 오류
 */
const generateEmbeddings = async (req, res) => {
  try {
    const { all = false } = req.body;

    // 임베딩 생성
    const result = await styleGuideService.generateAllEmbeddings(all);

    res.status(200).json({
      success: true,
      message: "벡터 임베딩 생성이 완료되었습니다",
      data: result,
    });
  } catch (error) {
    logger.error(`벡터 임베딩 생성 오류: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `벡터 임베딩 생성 중 오류가 발생했습니다: ${error.message}`,
    });
  }
};

/**
 * 벡터 검색 기능을 테스트합니다.
 * @async
 * @function testVectorSearch
 * @param {Object} req - Express 요청 객체
 * @param {Object} req.body - 요청 바디
 * @param {string} req.body.query - 검색 쿼리
 * @param {number} [req.body.limit=5] - 결과 제한 수
 * @param {Object} res - Express 응답 객체
 * @returns {Object} 검색 결과
 * @throws {Error} 벡터 검색 중 발생한 오류
 */
const testVectorSearch = async (req, res) => {
  try {
    const { query, limit = 5 } = req.body;

    if (!query) {
      return res.status(400).json({
        success: false,
        message: "검색할 쿼리가 제공되지 않았습니다.",
      });
    }

    // 벡터 검색 테스트
    const result = await styleGuideService.vectorSearch(query, limit);

    res.status(200).json({
      success: true,
      data: {
        results: result,
      },
    });
  } catch (error) {
    logger.error(`벡터 검색 테스트 오류: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `벡터 검색 테스트 중 오류가 발생했습니다: ${error.message}`,
    });
  }
};

module.exports = {
  getStyleguides,
  getStyleguideById,
  getRelatedStyleguides,
  getCategories,
  getTags,
  createStyleguide,
  updateStyleguide,
  deleteStyleguide,
  importStylebook,
  generateEmbeddings,
  testVectorSearch,
};
