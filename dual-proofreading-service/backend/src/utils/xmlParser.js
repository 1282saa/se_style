const fs = require("fs");
const path = require("path");
const { parseString } = require("xml2js");
const logger = require("./logger");
const util = require("util");

// xml2js의 parseString을 Promise로 변환
const parseStringPromise = util.promisify(parseString);

/**
 * XML 파일을 읽고 파싱합니다.
 * @param {string} filePath - XML 파일 경로
 * @param {object} options - 파싱 옵션
 * @returns {Promise<object>} - 파싱된 객체
 */
async function parseXmlFile(filePath, options = {}) {
  try {
    const xmlData = fs.readFileSync(filePath, "utf8");
    const result = await parseStringPromise(xmlData, {
      explicitArray: false,
      mergeAttrs: true,
      ...options,
    });
    return result;
  } catch (error) {
    logger.error(`XML 파일 파싱 오류 (${filePath}): ${error.message}`);
    throw new Error(`XML 파일 파싱 실패: ${error.message}`);
  }
}

/**
 * 서울경제 교열 규칙 XML 파일을 파싱합니다.
 * @returns {Promise<object>} - 파싱된 교열 규칙 객체
 */
async function parseSeoulEconomicRules() {
  try {
    const rulesPath = path.join(
      process.cwd(),
      "data",
      "styleguide",
      "seouleconomic-editing-rules.xml"
    );

    const parsedRules = await parseXmlFile(rulesPath);

    logger.info("서울경제 교열 규칙 파싱 완료");
    return parsedRules;
  } catch (error) {
    logger.error(`서울경제 교열 규칙 파싱 오류: ${error.message}`);
    return null;
  }
}

module.exports = {
  parseXmlFile,
  parseSeoulEconomicRules,
};
