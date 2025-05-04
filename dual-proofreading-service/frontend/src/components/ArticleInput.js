import React, { useState } from "react";
import { articleApi } from "../services/api";

const ArticleInput = ({ onArticleSubmitted }) => {
  const [originalText, setOriginalText] = useState("");
  const [topic, setTopic] = useState("");
  const [category, setCategory] = useState("일반");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  // 카테고리 옵션
  const categoryOptions = [
    "일반",
    "경제",
    "정치",
    "사회",
    "국제",
    "문화",
    "스포츠",
    "기술",
    "과학",
    "기타",
  ];

  // 기사 제출 처리
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // 필수 입력값 확인
    if (!originalText.trim()) {
      setError("기사 내용을 입력해주세요.");
      return;
    }

    // 사용자 ID 생성 또는 가져오기
    let userId = localStorage.getItem("userId");
    if (!userId) {
      userId = "anonymous-" + Date.now();
      localStorage.setItem("userId", userId);
    }

    const articleData = {
      userId,
      originalText,
      topic: topic || "제목 없음",
      category,
    };

    try {
      setIsSubmitting(true);
      const response = await articleApi.createArticle(articleData);

      // 교열 프로세스 시작
      await articleApi.proofreadArticle(response.data._id);

      // 결과 페이지로 이동
      if (onArticleSubmitted) {
        onArticleSubmitted(response.data._id);
      }
    } catch (err) {
      console.error("기사 제출 오류:", err);
      setError("서버 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-xl font-semibold mb-4">기사 입력</h2>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label
            htmlFor="topic"
            className="block text-gray-700 font-medium mb-2"
          >
            기사 제목 (선택사항)
          </label>
          <input
            type="text"
            id="topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            placeholder="기사 제목을 입력하세요"
          />
        </div>

        <div className="mb-4">
          <label
            htmlFor="category"
            className="block text-gray-700 font-medium mb-2"
          >
            카테고리
          </label>
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          >
            {categoryOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-6">
          <label
            htmlFor="originalText"
            className="block text-gray-700 font-medium mb-2"
          >
            기사 내용
          </label>
          <textarea
            id="originalText"
            value={originalText}
            onChange={(e) => setOriginalText(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md h-64"
            placeholder="교열할 기사 내용을 입력하세요"
            required
          />
          <p className="text-sm text-gray-500 mt-1">
            글자 수: {originalText.length}
          </p>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className={`w-full bg-blue-600 text-white py-2 px-4 rounded-md font-medium ${
            isSubmitting ? "opacity-50 cursor-not-allowed" : "hover:bg-blue-700"
          }`}
        >
          {isSubmitting ? "처리 중..." : "교열하기"}
        </button>
      </form>
    </div>
  );
};

export default ArticleInput;
