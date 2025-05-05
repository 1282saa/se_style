import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import SemanticSearch from "../components/SemanticSearch";

/**
 * 스타일 가이드 시맨틱 검색 페이지
 */
const StyleGuideSearchPage = () => {
  const navigate = useNavigate();
  const [selectedGuide, setSelectedGuide] = useState(null);

  // 스타일 가이드 선택 핸들러
  const handleSelectGuide = (guide) => {
    setSelectedGuide(guide);
    // 필요시 상세 페이지로 이동 로직을 추가할 수 있습니다
    // navigate(`/styleguides/${guide._id}`);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">스타일 가이드 지능형 검색</h1>
      <p className="text-gray-600 mb-8">
        질문이나 문맥을 입력하여 관련된 맞춤법, 표현, 스타일 가이드를
        찾아보세요. 인공지능이 가장 관련성 높은 규칙을 찾아줍니다.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <SemanticSearch onSelect={handleSelectGuide} className="mb-8" />
        </div>

        <div className="bg-gray-50 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">검색 도움말</h2>
          <ul className="list-disc pl-5 space-y-2 text-gray-700">
            <li>
              <strong>자연어 질문:</strong> "조사 '를'과 '을'은 언제
              사용하나요?"
            </li>
            <li>
              <strong>오류 예시:</strong> "맞춤법이 틀린것 같은데 맞나요?"
            </li>
            <li>
              <strong>주제 검색:</strong> "띄어쓰기 규칙에 대해 알려주세요"
            </li>
            <li>
              <strong>특정 맥락:</strong> "뉴스 기사 작성시 숫자 표기법"
            </li>
          </ul>
          <div className="mt-6 p-4 bg-blue-50 rounded">
            <h3 className="font-medium text-blue-800 mb-2">알림</h3>
            <p className="text-sm text-blue-700">
              검색 결과는 입력한 질문과의 의미적 유사성을 기준으로 정렬됩니다.
              결과의 정확도는 질문의 구체성에 따라 달라질 수 있습니다.
            </p>
          </div>
        </div>
      </div>

      {selectedGuide && (
        <div className="mt-8 p-6 border rounded-lg bg-white shadow-sm">
          <h2 className="text-xl font-bold mb-4">{selectedGuide.section}</h2>
          <div className="flex items-center mb-4">
            <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
              {selectedGuide.category}
            </span>
          </div>
          <div className="prose max-w-none">
            <p>{selectedGuide.content}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default StyleGuideSearchPage;
