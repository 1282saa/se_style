import React, { useState } from "react";

/**
 * 교열 결과의 우선순위 등급을 설명하는 컴포넌트
 */
const PriorityLevelsGuide = () => {
  const [isOpen, setIsOpen] = useState(false);

  const priorityLevels = [
    {
      id: "P5",
      name: "필수 수정",
      description: "의미 혼동이나 심각한 문법 오류로 반드시 수정 필요",
      color: "bg-red-100 border-red-500 text-red-700",
    },
    {
      id: "P4",
      name: "중요 수정",
      description: "표준 맞춤법 위반으로 수정이 권장됨",
      color: "bg-orange-100 border-orange-500 text-orange-700",
    },
    {
      id: "P3",
      name: "권장 수정",
      description: "가독성 향상을 위한 개선 사항",
      color: "bg-yellow-100 border-yellow-500 text-yellow-700",
    },
    {
      id: "P2",
      name: "참고 사항",
      description: "선호되는 표현이나 스타일 제안",
      color: "bg-blue-100 border-blue-500 text-blue-700",
    },
    {
      id: "P1",
      name: "주의 사항",
      description: "상황에 따라 달라질 수 있는 표현",
      color: "bg-gray-100 border-gray-500 text-gray-700",
    },
  ];

  return (
    <div className="mb-6">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center text-blue-600 hover:text-blue-800 mb-2 text-sm font-medium"
      >
        <span>
          {isOpen ? "교열 우선순위 등급 닫기" : "교열 우선순위 등급 보기"}
        </span>
        <svg
          className={`ml-1 w-5 h-5 transition-transform ${
            isOpen ? "rotate-180" : ""
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

      {isOpen && (
        <div className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
          <h3 className="text-md font-semibold mb-3">
            교열 우선순위 등급 안내
          </h3>
          <div className="space-y-2">
            {priorityLevels.map((level) => (
              <div
                key={level.id}
                className={`rounded-md border px-3 py-2 ${level.color}`}
              >
                <span className="font-semibold">
                  {level.id} ({level.name})
                </span>
                : {level.description}
              </div>
            ))}
          </div>
          <p className="mt-3 text-sm text-gray-600">
            본 교열 시스템은 서울경제신문 교열 규칙에 따라 위의 우선순위로 교정
            사항을 분류합니다.
            <br />
            필수 수정(P5)과 중요 수정(P4)은 반드시 검토하시기 바랍니다.
          </p>
        </div>
      )}
    </div>
  );
};

export default PriorityLevelsGuide;
