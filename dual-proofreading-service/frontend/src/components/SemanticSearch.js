import React, { useState } from "react";
import { styleGuideApi } from "../services/api";

/**
 * 시맨틱 검색 컴포넌트
 * 입력된 텍스트와 의미적으로 유사한 스타일 가이드를 검색
 */
const SemanticSearch = ({ onSelect, className = "" }) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // 검색 실행
  const handleSearch = async () => {
    if (!query.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await styleGuideApi.searchSemantic(query);
      setResults(response.data.data.results || []);
    } catch (err) {
      console.error("시맨틱 검색 오류:", err);
      setError("검색 중 오류가 발생했습니다. 다시 시도해주세요.");
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  // 엔터키 처리
  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSearch();
    }
  };

  // 검색 결과 항목 선택
  const handleSelectGuide = (guide) => {
    if (onSelect && typeof onSelect === "function") {
      onSelect(guide);
    }
  };

  return (
    <div className={`semantic-search ${className}`}>
      <div className="search-form flex mb-4">
        <input
          type="text"
          className="flex-grow p-2 border rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="교정 규칙이나 맞춤법에 대해 질문하세요..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          className="bg-blue-500 text-white px-4 py-2 rounded-r-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          onClick={handleSearch}
          disabled={loading}
        >
          {loading ? "검색 중..." : "검색"}
        </button>
      </div>

      {error && <div className="error text-red-500 mb-4">{error}</div>}

      <div className="search-results">
        {results.length > 0 ? (
          <div className="results-list divide-y">
            {results.map((item, index) => (
              <div
                key={item.guide._id || index}
                className="result-item p-3 hover:bg-gray-50 cursor-pointer"
                onClick={() => handleSelectGuide(item.guide)}
              >
                <div className="flex justify-between items-start">
                  <h3 className="text-lg font-medium">{item.guide.section}</h3>
                  <span className="text-sm text-gray-500">
                    유사도: {(item.score * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="text-sm text-gray-700 mt-1">
                  {item.guide.category}
                </div>
                <p className="text-gray-800 mt-2">
                  {item.guide.content.length > 120
                    ? `${item.guide.content.substring(0, 120)}...`
                    : item.guide.content}
                </p>
              </div>
            ))}
          </div>
        ) : query && !loading ? (
          <div className="no-results p-4 text-center text-gray-500">
            검색 결과가 없습니다.
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default SemanticSearch;
