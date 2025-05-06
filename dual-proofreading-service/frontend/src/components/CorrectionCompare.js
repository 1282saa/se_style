import React, { useState, useEffect } from "react";
import { articleApi } from "../services/api";
import PriorityLevelsGuide from "./PriorityLevelsGuide";
import CorrectionDetails from "./CorrectionDetails";

// 교열 결과를 비교 표시하는 컴포넌트
const CorrectionCompare = ({ articleId }) => {
  const [article, setArticle] = useState(null);
  const [corrections, setCorrections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedChoice, setSelectedChoice] = useState(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  // 컴포넌트 마운트 시 데이터 로드
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // 기사 정보 조회
        const articleResponse = await articleApi.getArticle(articleId);
        setArticle(articleResponse.data);

        // 교열 결과 조회
        const correctionsResponse = await articleApi.getCorrections(articleId);
        setCorrections(correctionsResponse.data);
      } catch (err) {
        console.error("데이터 로드 오류:", err);
        setError("교열 결과를 불러오는데 실패했습니다.");
      } finally {
        setLoading(false);
      }
    };

    if (articleId) {
      fetchData();
    }
  }, [articleId]);

  // 사용자 선택 및 피드백 제출
  const handleSubmitFeedback = async () => {
    if (!selectedChoice) {
      alert("선호하는 교열 결과를 선택해주세요.");
      return;
    }

    try {
      await articleApi.saveUserChoice(articleId, {
        selectedPromptType: selectedChoice,
        rating,
        comment,
      });

      setFeedbackSubmitted(true);
    } catch (err) {
      console.error("피드백 제출 오류:", err);
      alert("피드백 제출 중 오류가 발생했습니다.");
    }
  };

  // 로딩 중 표시
  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
        <p className="mt-4 text-gray-600">교열 결과를 불러오는 중...</p>
      </div>
    );
  }

  // 에러 표시
  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        <p>{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-2 bg-red-500 hover:bg-red-600 text-white py-1 px-3 rounded"
        >
          다시 시도
        </button>
      </div>
    );
  }

  // 교열 결과가 없을 경우
  if (!corrections || corrections.length === 0) {
    return (
      <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
        <p>교열 결과가 아직 생성되지 않았습니다. 잠시 후 다시 확인해주세요.</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-2 bg-yellow-500 hover:bg-yellow-600 text-white py-1 px-3 rounded"
        >
          새로고침
        </button>
      </div>
    );
  }

  // 교열 결과 가져오기
  const getCorrection = (promptType) => {
    return corrections.find((c) => c.promptType === promptType) || null;
  };

  const minimalCorrection = getCorrection(1);
  const enhancedCorrection = getCorrection(2);

  return (
    <div>
      {/* 원문 표시 */}
      <div className="mb-8">
        <h2 className="text-xl font-bold mb-3">원문</h2>
        <div className="bg-gray-100 p-4 rounded-lg whitespace-pre-wrap">
          {article?.originalText || ""}
        </div>
        <div className="mt-2 text-sm text-gray-500">
          {article?.topic && (
            <span className="mr-4">제목: {article.topic}</span>
          )}
          {article?.category && <span>카테고리: {article.category}</span>}
        </div>
      </div>

      {/* 우선순위 등급 가이드 추가 */}
      <PriorityLevelsGuide />

      {/* 교열 결과 비교 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* 프롬프트1 결과 (최소한의 교정) */}
        <div
          className={`bg-white p-4 rounded-lg shadow border-2 ${
            selectedChoice === 1 ? "border-blue-500" : "border-transparent"
          }`}
          onClick={() => setSelectedChoice(1)}
        >
          <h3 className="text-lg font-semibold mb-2">기본 교정</h3>
          <p className="text-sm text-gray-500 mb-3">
            맞춤법, 띄어쓰기, 문법 오류만 수정
          </p>
          <div className="bg-gray-50 p-3 rounded whitespace-pre-wrap min-h-[200px]">
            {minimalCorrection?.correctedText || "결과를 불러오는 중..."}
          </div>

          {/* 최소 교정 상세 내용 */}
          <CorrectionDetails correction={minimalCorrection} />

          <div className="mt-4 flex justify-center">
            <button
              className={`px-4 py-2 rounded ${
                selectedChoice === 1
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
              onClick={() => setSelectedChoice(1)}
            >
              이 결과 선택
            </button>
          </div>
        </div>

        {/* 프롬프트2 결과 (적극적인 개선) */}
        <div
          className={`bg-white p-4 rounded-lg shadow border-2 ${
            selectedChoice === 2 ? "border-blue-500" : "border-transparent"
          }`}
          onClick={() => setSelectedChoice(2)}
        >
          <h3 className="text-lg font-semibold mb-2">향상된 교정</h3>
          <p className="text-sm text-gray-500 mb-3">
            문체와 표현까지 적극적으로 개선
          </p>
          <div className="bg-gray-50 p-3 rounded whitespace-pre-wrap min-h-[200px]">
            {enhancedCorrection?.correctedText || "결과를 불러오는 중..."}
          </div>

          {/* 향상된 교정 상세 내용 */}
          <CorrectionDetails correction={enhancedCorrection} />

          <div className="mt-4 flex justify-center">
            <button
              className={`px-4 py-2 rounded ${
                selectedChoice === 2
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
              onClick={() => setSelectedChoice(2)}
            >
              이 결과 선택
            </button>
          </div>
        </div>
      </div>

      {/* 피드백 섹션 */}
      {!feedbackSubmitted ? (
        <div className="bg-white p-6 rounded-lg shadow mb-8">
          <h3 className="text-lg font-semibold mb-4">피드백 제출</h3>

          <div className="mb-4">
            <label className="block text-gray-700 font-medium mb-2">별점</label>
            <div className="flex items-center">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className={`text-2xl ${
                    star <= rating ? "text-yellow-400" : "text-gray-300"
                  }`}
                >
                  ★
                </button>
              ))}
              <span className="ml-2 text-gray-600">{rating}/5</span>
            </div>
          </div>

          <div className="mb-4">
            <label
              htmlFor="comment"
              className="block text-gray-700 font-medium mb-2"
            >
              코멘트 (선택사항)
            </label>
            <textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md h-24"
              placeholder="교정 결과에 대한 의견을 남겨주세요"
            />
          </div>

          <button
            onClick={handleSubmitFeedback}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md font-medium hover:bg-blue-700"
            disabled={!selectedChoice}
          >
            피드백 제출
          </button>
        </div>
      ) : (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-8">
          <p className="font-medium">피드백이 성공적으로 제출되었습니다!</p>
          <p className="mt-2">
            소중한 의견 감사합니다. 더 나은 교열 서비스를 제공하기 위해
            노력하겠습니다.
          </p>
        </div>
      )}
    </div>
  );
};

export default CorrectionCompare;
