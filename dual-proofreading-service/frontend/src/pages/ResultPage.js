import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { articleApi } from "../services/api";
import SocialShareModal from "../components/SocialShareModal";

const ResultPage = () => {
  const { articleId } = useParams();
  const [article, setArticle] = useState(null);
  const [corrections, setCorrections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCorrection, setSelectedCorrection] = useState(null);
  const [showSocialModal, setShowSocialModal] = useState(false);

  useEffect(() => {
    // 기사 및 교정 결과 로드
    const fetchArticleData = async () => {
      try {
        setLoading(true);

        // 기사 정보 불러오기
        const articleResponse = await articleApi.getArticle(articleId);
        setArticle(articleResponse.data.data);

        // 교정 결과 불러오기
        const correctionsResponse = await articleApi.getCorrections(articleId);
        setCorrections(correctionsResponse.data.data.corrections || []);

        // 첫번째 교정 결과 선택
        if (correctionsResponse.data.data.corrections?.length > 0) {
          setSelectedCorrection(correctionsResponse.data.data.corrections[0]);
        }
      } catch (err) {
        console.error("데이터 로드 오류:", err);
        setError("교정 결과를 불러오는데 실패했습니다");
      } finally {
        setLoading(false);
      }
    };

    fetchArticleData();
  }, [articleId]);

  const handleCorrectionSelect = (correction) => {
    setSelectedCorrection(correction);
  };

  const handleSocialShare = () => {
    setShowSocialModal(true);
  };

  const handleCloseModal = () => {
    setShowSocialModal(false);
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <h1 style={styles.title}>교정 결과 로딩 중...</h1>
        <div style={styles.spinner}></div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <h1 style={styles.title}>오류 발생</h1>
        <p style={styles.error}>{error}</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>교정 결과</h1>

      {article && (
        <div style={styles.articleInfo}>
          <p>
            <strong>기사 ID:</strong> {articleId}
          </p>
          <p>
            <strong>생성일:</strong>{" "}
            {new Date(article.createdAt).toLocaleString()}
          </p>
        </div>
      )}

      <div style={styles.contentContainer}>
        {/* 원문 */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>원문</h2>
          <div style={styles.textBox}>
            <p style={styles.text}>{article?.originalText}</p>
          </div>
        </div>

        {/* 교정 결과 선택 */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>교정 결과</h2>

          <div style={styles.correctionTabs}>
            {corrections.map((correction) => (
              <button
                key={correction._id}
                style={{
                  ...styles.tabButton,
                  ...(selectedCorrection?._id === correction._id
                    ? styles.activeTab
                    : {}),
                }}
                onClick={() => handleCorrectionSelect(correction)}
              >
                {correction.promptType === 1
                  ? "최소 교정"
                  : correction.promptType === 2
                  ? "적극적 교정"
                  : "맞춤형 교정"}
              </button>
            ))}
          </div>

          {selectedCorrection ? (
            <>
              <div style={styles.textBox}>
                <p style={styles.text}>{selectedCorrection.correctedText}</p>
              </div>

              <div style={styles.actions}>
                <button style={styles.shareButton} onClick={handleSocialShare}>
                  소셜 미디어에 공유하기
                </button>
              </div>
            </>
          ) : (
            <p style={styles.noData}>교정 결과가 없습니다.</p>
          )}
        </div>
      </div>

      {/* 소셜 미디어 공유 모달 */}
      {showSocialModal && (
        <SocialShareModal
          articleId={articleId}
          correctionId={selectedCorrection?._id}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
};

// 인라인 스타일
const styles = {
  container: {
    maxWidth: "1200px",
    margin: "0 auto",
    padding: "2rem",
  },
  title: {
    fontSize: "28px",
    color: "#333",
    marginBottom: "1.5rem",
  },
  articleInfo: {
    marginBottom: "1.5rem",
    padding: "0.8rem",
    backgroundColor: "#f8f9fa",
    borderRadius: "4px",
  },
  contentContainer: {
    display: "flex",
    flexDirection: "column",
    gap: "2rem",
  },
  section: {
    backgroundColor: "#fff",
    borderRadius: "6px",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
    padding: "1.5rem",
  },
  sectionTitle: {
    fontSize: "20px",
    color: "#333",
    marginTop: 0,
    marginBottom: "1rem",
  },
  textBox: {
    padding: "1rem",
    backgroundColor: "#f8f9fa",
    borderRadius: "4px",
    minHeight: "200px",
  },
  text: {
    whiteSpace: "pre-wrap",
    lineHeight: 1.6,
    margin: 0,
  },
  correctionTabs: {
    display: "flex",
    marginBottom: "1rem",
    borderBottom: "1px solid #ddd",
  },
  tabButton: {
    padding: "0.5rem 1rem",
    backgroundColor: "transparent",
    border: "none",
    borderBottom: "3px solid transparent",
    cursor: "pointer",
    fontSize: "16px",
    marginRight: "1rem",
  },
  activeTab: {
    borderBottomColor: "#007bff",
    color: "#007bff",
    fontWeight: "bold",
  },
  actions: {
    marginTop: "1rem",
    display: "flex",
    justifyContent: "flex-end",
  },
  shareButton: {
    backgroundColor: "#28a745",
    color: "#fff",
    border: "none",
    borderRadius: "4px",
    padding: "0.5rem 1rem",
    fontSize: "14px",
    cursor: "pointer",
  },
  spinner: {
    border: "4px solid rgba(0, 0, 0, 0.1)",
    width: "36px",
    height: "36px",
    borderRadius: "50%",
    borderLeftColor: "#007bff",
    animation: "spin 1s linear infinite",
  },
  error: {
    color: "#dc3545",
    backgroundColor: "#f8d7da",
    padding: "1rem",
    borderRadius: "4px",
  },
  noData: {
    color: "#6c757d",
    fontStyle: "italic",
    textAlign: "center",
    padding: "2rem",
  },
};

export default ResultPage;
