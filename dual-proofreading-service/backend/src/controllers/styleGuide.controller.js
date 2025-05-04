// src/controllers/styleGuide.controller.js
const Styleguide = require("../models/styleguide.model");
const styleGuideService = require("../services/styleGuideService");
const logger = require("../utils/logger");
const fs = require("fs").promises;
const path = require("path");
const config = require("../config");

/**
 * 스타일 가이드 목록을 조회합니다.
 * @route GET /api/style-guides
 */
const getStyleGuides = async (req, res) => {
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
    const styleGuides = await Styleguide.find(query, null, options);
    const total = await Styleguide.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        styleGuides,
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
 * @route GET /api/style-guides/:id
 */
const getStyleGuide = async (req, res) => {
  try {
    const { id } = req.params;

    const styleGuide = await Styleguide.findById(id);
    if (!styleGuide) {
      return res.status(404).json({
        success: false,
        message: "스타일 가이드를 찾을 수 없습니다.",
      });
    }

    res.status(200).json({
      success: true,
      data: styleGuide,
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
 * 텍스트와 관련된 스타일 가이드를 검색합니다.
 * @route POST /api/style-guides/search
 */
const searchRelatedStyleGuides = async (req, res) => {
  try {
    const { text, limit = 5 } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        message: "검색할 텍스트가 제공되지 않았습니다.",
      });
    }

    // 관련 스타일 가이드 검색
    const relatedStyleGuides = await styleGuideService.findRelatedStyleGuides(
      text,
      limit
    );

    res.status(200).json({
      success: true,
      data: {
        relatedStyleGuides,
      },
    });
  } catch (error) {
    logger.error(`관련 스타일 가이드 검색 오류: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `관련 스타일 가이드 검색 중 오류가 발생했습니다: ${error.message}`,
    });
  }
};

/**
 * 모든 카테고리 목록을 조회합니다.
 * @route GET /api/style-guides/categories
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
 * @route GET /api/style-guides/tags
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
 * 스타일 가이드를 생성합니다.
 * @route POST /api/style-guides
 */
const createStyleGuide = async (req, res) => {
  try {
    const styleGuideData = {
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
      !styleGuideData.section ||
      !styleGuideData.content ||
      !styleGuideData.category
    ) {
      return res.status(400).json({
        success: false,
        message: "section, content, category 필드는 필수입니다.",
      });
    }

    // 스타일 가이드 생성
    const styleGuide = new Styleguide(styleGuideData);
    const savedStyleGuide = await styleGuide.save();

    // 벡터 임베딩 생성 (비동기적으로 처리)
    styleGuideService
      .generateEmbedding(savedStyleGuide._id)
      .catch((err) => logger.error(`벡터 임베딩 생성 오류: ${err.message}`));

    res.status(201).json({
      success: true,
      message: "스타일 가이드가 성공적으로 생성되었습니다",
      data: savedStyleGuide,
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
 * @route PUT /api/style-guides/:id
 */
const updateStyleGuide = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // ID로 스타일 가이드 조회
    const styleGuide = await Styleguide.findById(id);
    if (!styleGuide) {
      return res.status(404).json({
        success: false,
        message: "스타일 가이드를 찾을 수 없습니다.",
      });
    }

    // 업데이트 데이터 적용
    Object.keys(updateData).forEach((key) => {
      styleGuide[key] = updateData[key];
    });

    // 업데이트된 스타일 가이드 저장
    const updatedStyleGuide = await styleGuide.save();

    // 컨텐츠가 변경되었다면 벡터 임베딩 재생성
    if (updateData.content) {
      styleGuideService
        .generateEmbedding(updatedStyleGuide._id)
        .catch((err) =>
          logger.error(`벡터 임베딩 재생성 오류: ${err.message}`)
        );
    }

    res.status(200).json({
      success: true,
      message: "스타일 가이드가 성공적으로 업데이트되었습니다",
      data: updatedStyleGuide,
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
 * @route DELETE /api/style-guides/:id
 */
const deleteStyleGuide = async (req, res) => {
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
 * @route POST /api/style-guides/import
 */
const importStyleBook = async (req, res) => {
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
    let styleBookData;

    try {
      styleBookData = JSON.parse(fileContent);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: "스타일북 파일이 유효한 JSON 형식이 아닙니다.",
      });
    }

    // 스타일북 데이터 가져오기
    const result = await styleGuideService.importStyleBook(styleBookData);

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
 * @route POST /api/style-guides/generate-embeddings
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
 * @route POST /api/style-guides/vector-search
 */
const testVectorSearch = async (req, res) => {
  try {
    const { text, limit = 5 } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        message: "검색할 텍스트가 제공되지 않았습니다.",
      });
    }

    // 벡터 검색 테스트
    const result = await styleGuideService.vectorSearch(text, limit);

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
  getStyleGuides,
  getStyleGuide,
  searchRelatedStyleGuides,
  getCategories,
  getTags,
  createStyleGuide,
  updateStyleGuide,
  deleteStyleGuide,
  importStyleBook,
  generateEmbeddings,
  testVectorSearch,
};
