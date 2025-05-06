import React from "react";

/**
 * 교정 변경 사항을 표시하는 컴포넌트
 * @param {Object} change - 변경 사항 객체
 * @param {string} change.original - 원문
 * @param {string} change.suggestion/corrected - 수정 제안
 * @param {string} change.explanation/reason - 수정 이유
 * @param {number|string} change.priority - 우선순위 (P1-P5)
 */
const CorrectionChangesItem = ({ change }) => {
  // 필드명 표준화 (API 응답 형식 차이 대응)
  const original = change.original || change.originalText;
  const suggestion = change.suggestion || change.corrected;
  const explanation = change.explanation || change.reason;

  // 우선순위 처리 (문자열 또는 숫자 형식 모두 대응)
  let priority = change.priority;
  if (typeof priority === "number") {
    priority = `P${priority}`;
  }

  // 우선순위에 따른 스타일 설정
  const getPriorityStyle = (priority) => {
    switch (priority) {
      case "P5":
        return "bg-red-100 text-red-800 border-red-300";
      case "P4":
        return "bg-orange-100 text-orange-800 border-orange-300";
      case "P3":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "P2":
        return "bg-blue-100 text-blue-800 border-blue-300";
      case "P1":
        return "bg-gray-100 text-gray-800 border-gray-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  // 우선순위에 따른 레이블 텍스트
  const getPriorityLabel = (priority) => {
    switch (priority) {
      case "P5":
        return "필수 수정";
      case "P4":
        return "중요 수정";
      case "P3":
        return "권장 수정";
      case "P2":
        return "참고 사항";
      case "P1":
        return "주의 사항";
      default:
        return "참고 사항";
    }
  };

  return (
    <div className="border rounded-md p-3 mb-2 hover:bg-gray-50 transition-colors">
      <div className="flex flex-wrap items-center mb-2">
        <span
          className={`text-xs font-medium px-2 py-1 rounded border ${getPriorityStyle(
            priority
          )} mr-2`}
        >
          {priority} {getPriorityLabel(priority)}
        </span>
      </div>

      <div className="flex flex-col">
        <div className="mb-1">
          <span className="line-through text-red-600">{original}</span>
          <span className="mx-2">→</span>
          <span className="text-green-600 font-medium">{suggestion}</span>
        </div>

        {explanation && (
          <div className="text-sm text-gray-600 ml-2">{explanation}</div>
        )}
      </div>
    </div>
  );
};

export default CorrectionChangesItem;
