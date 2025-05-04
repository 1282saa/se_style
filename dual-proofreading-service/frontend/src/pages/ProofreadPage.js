import React, { useState } from "react";
import { articleApi } from "../services/api";

const ProofreadPage = () => {
  const [articleText, setArticleText] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleTextChange = (e) => {
    setArticleText(e.target.value);
  };

  const handleSubmit = async () => {
    if (!articleText.trim()) {
      setError("텍스트를 입력해주세요.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setResults(null);

      // API 호출
      const response = await articleApi.createArticle({
        originalText: articleText,
        userId: "user123", // 실제 환경에서는 로그인한 사용자 ID로 대체
      });

      const articleId = response.data.data.articleId;

      // 교정 실행
      const proofreadResponse = await articleApi.proofreadArticle(articleId);

      // 교정 결과 조회
      const correctionResponse = await articleApi.getCorrections(articleId);

      // 결과 설정
      const correctionData = correctionResponse.data.data;

      // 두 가지 버전의 교정 결과 설정
      const minimalCorrection = correctionData.corrections.find(
        (c) => c.promptType === 1
      );
      const enhancedCorrection = correctionData.corrections.find(
        (c) => c.promptType === 2
      );

      setResults({
        articleId,
        original: articleText,
        minimal:
          minimalCorrection?.correctedText || "교정 결과를 불러올 수 없습니다.",
        enhanced:
          enhancedCorrection?.correctedText ||
          "교정 결과를 불러올 수 없습니다.",
      });
    } catch (err) {
      console.error("교정 중 오류 발생:", err);
      setError(
        "교정을 처리하는 중 오류가 발생했습니다. 나중에 다시 시도해주세요."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleQuickProofread = async () => {
    if (!articleText.trim()) {
      setError("텍스트를 입력해주세요.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setResults(null);

      // 빠른 교정 API 호출
      const response = await fetch(
        "http://localhost:3003/api/articles/quick-proofread",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: articleText,
            userId: "user123", // 실제 환경에서는 로그인한 사용자 ID로 대체
            metadata: {},
          }),
        }
      );

      if (!response.ok) {
        throw new Error("API 요청 실패");
      }

      const result = await response.json();

      if (result.success) {
        setResults({
          articleId: result.data.articleId,
          original: articleText,
          minimal: result.data.correction1.text,
          enhanced: result.data.correction2.text,
        });
      } else {
        throw new Error(result.message || "교정 처리 실패");
      }
    } catch (err) {
      console.error("교정 중 오류 발생:", err);
      setError(
        "교정을 처리하는 중 오류가 발생했습니다. 나중에 다시 시도해주세요."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "20px" }}>
      <h1 style={{ fontSize: "24px", marginBottom: "20px", color: "#333" }}>
        기사 교정 시스템
      </h1>

      <div style={{ marginBottom: "20px" }}>
        <textarea
          placeholder="교정할 기사 텍스트를 입력하세요..."
          value={articleText}
          onChange={handleTextChange}
          style={{
            width: "100%",
            minHeight: "200px",
            padding: "12px",
            border: "1px solid #ddd",
            borderRadius: "4px",
            fontSize: "16px",
            fontFamily: "Noto Sans KR, sans-serif",
            resize: "vertical",
          }}
        />
      </div>

      <button
        onClick={handleQuickProofread}
        disabled={loading || !articleText.trim()}
        style={{
          backgroundColor:
            loading || !articleText.trim() ? "#cccccc" : "#007bff",
          color: "white",
          padding: "10px 20px",
          border: "none",
          borderRadius: "4px",
          fontSize: "16px",
          cursor: loading || !articleText.trim() ? "not-allowed" : "pointer",
        }}
      >
        {loading ? "교정 중..." : "교정하기"}
      </button>

      {loading && (
        <div
          style={{
            border: "4px solid #f3f3f3",
            borderTop: "4px solid #3498db",
            borderRadius: "50%",
            width: "30px",
            height: "30px",
            animation: "spin 2s linear infinite",
            margin: "20px auto",
          }}
        />
      )}

      {error && (
        <p
          style={{
            color: "#dc3545",
            backgroundColor: "#f8d7da",
            padding: "10px",
            borderRadius: "4px",
            marginTop: "20px",
          }}
        >
          {error}
        </p>
      )}

      {results && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "20px",
            marginTop: "30px",
          }}
        >
          <div
            style={{
              border: "1px solid #ddd",
              borderRadius: "4px",
              padding: "15px",
              backgroundColor: "#f9f9f9",
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: "10px", color: "#333" }}>
              원문
            </h3>
            <p
              style={{ whiteSpace: "pre-wrap", lineHeight: 1.6, color: "#444" }}
            >
              {results.original}
            </p>
          </div>

          <div
            style={{
              border: "1px solid #ddd",
              borderRadius: "4px",
              padding: "15px",
              backgroundColor: "#f9f9f9",
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: "10px", color: "#333" }}>
              최소 교정 결과
            </h3>
            <p
              style={{ whiteSpace: "pre-wrap", lineHeight: 1.6, color: "#444" }}
            >
              {results.minimal}
            </p>
          </div>

          <div
            style={{
              border: "1px solid #ddd",
              borderRadius: "4px",
              padding: "15px",
              backgroundColor: "#f9f9f9",
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: "10px", color: "#333" }}>
              적극적 교정 결과
            </h3>
            <p
              style={{ whiteSpace: "pre-wrap", lineHeight: 1.6, color: "#444" }}
            >
              {results.enhanced}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProofreadPage;
