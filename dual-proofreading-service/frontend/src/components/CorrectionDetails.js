import React, { useState } from "react";
import CorrectionChangesItem from "./CorrectionChangesItem";

/**
 * 교정 결과 상세 내용을 보여주는 컴포넌트
 * @param {Object} correction - 교정 결과 객체
 */
const CorrectionDetails = ({ correction }) => {
  const [showDetails, setShowDetails] = useState(false);

  // 변경 사항이 없는 경우
  if (!correction || !correction.changes || correction.changes.length === 0) {
    return (
      <div className="mt-4 text-gray-500 text-sm">
        상세 교정 정보가 없습니다.
      </div>
    );
  }

  // 우선순위에 따라 변경 사항 정렬 및 필터링
  const sortedChanges = [...correction.changes].sort((a, b) => {
    // 우선순위가 문자열 형식(P5, P4...)일 수도 있고 숫자(5, 4...)일 수도 있음
    const priorityA =
      typeof a.priority === "string"
        ? parseInt(a.priority.replace("P", ""))
        : a.priority || 0;

    const priorityB =
      typeof b.priority === "string"
        ? parseInt(b.priority.replace("P", ""))
        : b.priority || 0;

    // 높은 우선순위(P5)가 먼저 오도록 내림차순 정렬
    return priorityB - priorityA;
  });

  // 필수 수정 사항과 참고 사항 분리
  const essentialChanges = sortedChanges.filter((change) => {
    const priority =
      typeof change.priority === "string"
        ? change.priority
        : `P${change.priority}`;
    return priority === "P5" || priority === "P4";
  });

  const referenceChanges = sortedChanges.filter((change) => {
    const priority =
      typeof change.priority === "string"
        ? change.priority
        : `P${change.priority}`;
    return priority === "P3" || priority === "P2" || priority === "P1";
  });

  return (
    <div className="mt-4">
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="flex items-center text-blue-600 hover:text-blue-800 mb-2 text-sm font-medium"
      >
        <span>
          {showDetails ? "상세 교정 내용 닫기" : "상세 교정 내용 보기"}
        </span>
        <svg
          className={`ml-1 w-5 h-5 transition-transform ${
            showDetails ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {showDetails && (
        <div className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
          {essentialChanges.length > 0 && (
            <div className="mb-6">
              <h4 className="text-md font-semibold mb-3 text-red-700">
                필수 수정 사항 ({essentialChanges.length})
              </h4>
              <div className="space-y-1">
                {essentialChanges.map((change, idx) => (
                  <CorrectionChangesItem key={idx} change={change} />
                ))}
              </div>
            </div>
          )}

          {referenceChanges.length > 0 && (
            <div>
              <h4 className="text-md font-semibold mb-3 text-blue-700">
                참고 사항 ({referenceChanges.length})
              </h4>
              <div className="space-y-1">
                {referenceChanges.map((change, idx) => (
                  <CorrectionChangesItem key={idx} change={change} />
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 text-sm text-gray-500">
            <p>총 {sortedChanges.length}개의 교정 사항이 있습니다.</p>
            <p>교정 모델: {correction.llmInfo?.model || "기본 모델"}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default CorrectionDetails;
