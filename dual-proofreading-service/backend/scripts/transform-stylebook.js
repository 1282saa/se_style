/**
 * 스타일북 JSON 파일 구조 변환 스크립트
 * 기존의 다양한 JSON 구조를 표준화된 구조로 변환합니다.
 *
 * 사용법:
 * 1. 이 파일을 프로젝트 루트의 scripts 폴더 같은 곳에 저장합니다. (예: backend/scripts/transform-stylebook.js)
 * 2. 터미널에서 backend 폴더로 이동합니다.
 * 3. 다음 명령어를 실행합니다: node scripts/transform-stylebook.js /경로/스타일북
 *    (경로를 생략하면 ../스타일북 을 기본값으로 사용합니다.)
 */
const fs = require("fs").promises;
const path = require("path");

// ★★★ 최종 표준 구조와 일치하는지 확인 필요 ★★★
const standardStructure = {
  file_id: "",
  title: "",
  description: "",
  category_path: [],
  tags: [],
  rules: [
    {
      rule_id: "",
      title: "",
      content: "",
      explanation: "",
      examples: [
        {
          incorrect: "",
          correct: "",
          description: "",
        },
      ],
      priority: 3,
      tags: [],
    },
  ],
};

/**
 * 지정된 디렉토리와 하위 디렉토리에서 JSON 파일을 재귀적으로 찾습니다.
 */
async function findJsonFilesRecursive(dir) {
  let jsonFiles = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        jsonFiles = jsonFiles.concat(await findJsonFilesRecursive(fullPath));
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".json")) {
        // 메타 파일 제외 (_meta.json 등)
        if (!entry.name.startsWith("_")) {
          jsonFiles.push(fullPath);
        }
      }
    }
  } catch (error) {
    console.warn(`디렉토리 접근/읽기 오류: ${dir} - ${error.message}`);
  }
  return jsonFiles;
}

/**
 * 기존 JSON 데이터를 읽어 표준 구조로 변환합니다.
 */
function transformData(originalData, filePath) {
  const newStructure = JSON.parse(JSON.stringify(standardStructure)); // Deep copy
  const fileName = path.basename(filePath);

  try {
    // 기존 데이터 구조 파악 (NAME-001.json 예시 기반)
    if (
      !originalData.rule_id ||
      !Array.isArray(originalData.versions) ||
      originalData.versions.length === 0
    ) {
      console.warn(
        `[${fileName}] 건너뜀: rule_id 또는 versions 필드가 유효하지 않습니다.`
      );
      return null;
    }

    const latestVersion =
      originalData.versions.find((v) => v.status === "active") ||
      originalData.versions[originalData.versions.length - 1];
    if (!latestVersion || !latestVersion.structure) {
      console.warn(
        `[${fileName}] 건너뜀: 활성 버전 또는 structure 필드를 찾을 수 없습니다.`
      );
      return null;
    }

    const structure = latestVersion.structure;

    // 기본 정보 매핑
    newStructure.file_id = originalData.rule_id;
    newStructure.title = structure.title || "제목 없음";
    newStructure.description = structure.description || "";
    newStructure.category_path = Array.isArray(structure.rule_path)
      ? structure.rule_path
      : [];
    newStructure.tags = Array.isArray(structure.tags)
      ? structure.tags.filter((t) => typeof t === "string")
      : [];

    // 개별 규칙(criteria) 매핑
    if (!structure.criteria || !Array.isArray(structure.criteria)) {
      console.warn(
        `[${fileName}] 건너뜀: structure 내에 criteria 배열이 없습니다.`
      );
      // criteria가 없으면 guidelines를 시도 (다른 구조 가능성)
      if (structure.guidelines && Array.isArray(structure.guidelines)) {
        console.log(`[${fileName}] 참고: criteria 대신 guidelines 사용 시도.`);
        structure.criteria = structure.guidelines; // 임시 할당
      } else {
        return null;
      }
    }

    newStructure.rules = structure.criteria
      .map((criterion) => {
        if (!criterion || !criterion.criteria_id) {
          console.warn(
            `[${fileName}] 건너뜀: 유효하지 않은 criteria 항목 발견.`
          );
          return null; // 유효하지 않은 항목은 제외
        }

        // 예시 파싱 (note 필드에서 간단히 추출 시도)
        const examples = [];
        if (criterion.note && typeof criterion.note === "string") {
          // 매우 기본적인 파싱 로직, 개선 필요
          const lines = criterion.note
            .split(/\n|예:/)
            .map((s) => s.trim())
            .filter(Boolean);
          lines.forEach((line) => {
            // "잘못됨: ... 올바름: ..." 같은 패턴 시도
            const match = line.match(/잘못됨:(.*?)(?:올바름:|$) (.*)/);
            if (match) {
              examples.push({
                incorrect: match[1]?.trim() || "",
                correct: match[2]?.trim() || "",
                description: "",
              });
            } else {
              // 단순 예시는 correct 필드에 저장
              examples.push({
                incorrect: "",
                correct: line,
                description: "예시",
              });
            }
          });
          // 기존 examples 필드도 확인 (더 복잡한 구조 처리)
          if (criterion.examples && Array.isArray(criterion.examples)) {
            criterion.examples.forEach((ex) => {
              if (ex && (ex.correct || ex.incorrect)) {
                examples.push({
                  incorrect: ex.incorrect || ex.wrong || "",
                  correct: ex.correct || "",
                  description: ex.description || ex.explanation || "",
                });
              }
            });
          }
        }

        return {
          rule_id: criterion.criteria_id,
          title: criterion.title || "규칙 제목 없음",
          content: criterion.description || "", // description을 content로 매핑
          explanation: criterion.explanation || criterion.description || "", // explanation이 없으면 description 사용
          examples: examples.filter((e) => e.correct || e.incorrect), // 내용이 있는 예시만 포함
          priority: parseInt(criterion.priority || "3", 10),
          tags: Array.isArray(criterion.tags)
            ? criterion.tags.filter((t) => typeof t === "string")
            : [],
        };
      })
      .filter(Boolean); // null 항목 제거

    // 변환된 규칙이 하나도 없으면 null 반환
    if (newStructure.rules.length === 0) {
      console.warn(`[${fileName}] 건너뜀: 유효한 규칙을 추출하지 못했습니다.`);
      return null;
    }

    return newStructure;
  } catch (parseError) {
    console.error(`[${fileName}] 파싱 오류: ${parseError.message}`);
    return null;
  }
}

/**
 * 메인 실행 함수
 */
async function main() {
  const args = process.argv.slice(2);
  const stylebookDirArg = args[0];

  if (!stylebookDirArg) {
    console.error(
      "오류: 스타일북 디렉토리 경로를 명령행 인수로 전달해야 합니다."
    );
    console.log("사용법: node scripts/transform-stylebook.js /경로/스타일북");
    process.exit(1);
  }

  const stylebookDir = path.resolve(stylebookDirArg); // 절대 경로로 변환

  console.log(`스타일북 변환 시작: ${stylebookDir}`);

  // 경로 존재 및 디렉토리 여부 확인 (비동기 방식으로 수정)
  try {
    const stats = await fs.stat(stylebookDir);
    if (!stats.isDirectory()) {
      console.error(`오류: 지정된 경로가 디렉토리가 아닙니다: ${stylebookDir}`);
      process.exit(1);
    }
  } catch (error) {
    if (error.code === "ENOENT") {
      // 파일/디렉토리가 존재하지 않는 경우
      console.error(`오류: 지정된 경로를 찾을 수 없습니다: ${stylebookDir}`);
    } else {
      // 그 외 접근 오류 등
      console.error(`오류: 경로 확인 중 문제 발생 (${stylebookDir}):`, error);
    }
    process.exit(1);
  }

  const jsonFiles = await findJsonFilesRecursive(stylebookDir);

  if (jsonFiles.length === 0) {
    console.log("변환할 JSON 파일을 찾지 못했습니다.");
    process.exit(0);
  }

  console.log(`${jsonFiles.length}개의 JSON 파일을 변환합니다...`);

  let transformedCount = 0;
  let errorCount = 0;

  for (const filePath of jsonFiles) {
    const fileName = path.basename(filePath);
    try {
      console.log(`처리 중: ${fileName}`);
      const originalJson = await fs.readFile(filePath, "utf8");
      const originalData = JSON.parse(originalJson);

      const transformedData = transformData(originalData, filePath);

      if (transformedData) {
        // 원본 파일 백업 (선택적이지만 권장)
        // await fs.copyFile(filePath, filePath + '.bak');

        // 변환된 데이터로 파일 덮어쓰기 (들여쓰기 포함하여 보기 좋게 저장)
        await fs.writeFile(
          filePath,
          JSON.stringify(transformedData, null, 2),
          "utf8"
        );
        transformedCount++;
      } else {
        errorCount++;
      }
    } catch (error) {
      console.error(`[${fileName}] 처리 중 오류 발생: ${error.message}`);
      errorCount++;
    }
  }

  console.log("\n스타일북 변환 완료!");
  console.log(`- 총 파일 수: ${jsonFiles.length}`);
  console.log(`- 성공적으로 변환된 파일 수: ${transformedCount}`);
  console.log(`- 변환 중 오류/건너<0xEB><0x9A><A5> 파일 수: ${errorCount}`);

  if (errorCount > 0) {
    console.warn(
      "\n일부 파일 처리 중 오류가 발생했거나 건너<0xEB><0x9A><A5>습니다. 로그를 확인하세요."
    );
  }
}

// 스크립트 실행
main().catch((err) => {
  console.error("스크립트 실행 중 예상치 못한 오류 발생:", err);
  process.exit(1);
});
