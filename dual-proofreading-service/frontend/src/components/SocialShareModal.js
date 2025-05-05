import React, { useState, useEffect } from "react";
import { socialMediaApi } from "../services/api";
import SocialStatsDashboard from "./SocialStatsDashboard";

/**
 * 소셜 미디어 공유 모달 컴포넌트
 * @param {Object} props - 컴포넌트 속성
 * @param {string} props.articleId - 기사 ID
 * @param {string} props.correctionId - 교정 결과 ID
 * @param {Function} props.onClose - 모달 닫기 핸들러
 */
const SocialShareModal = ({ articleId, correctionId, onClose }) => {
  const [platforms, setPlatforms] = useState([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState([]);
  const [generatedPosts, setGeneratedPosts] = useState({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState(null);
  const [userId] = useState("user123"); // 실제 환경에서는 사용자 인증 정보에서 가져와야 함

  // 새로운 상태 추가
  const [showConnectSection, setShowConnectSection] = useState(false);
  const [newCredentials, setNewCredentials] = useState({
    platform: "instagram",
    accessToken: "",
    platformUserId: "",
    username: "",
  });
  const [showStatistics, setShowStatistics] = useState(false);
  const [selectedStatPlatform, setSelectedStatPlatform] = useState(null);

  useEffect(() => {
    // 연결된 소셜 계정 목록 가져오기
    const fetchConnectedAccounts = async () => {
      try {
        const response = await socialMediaApi.getConnectedAccounts(userId);
        setPlatforms(response.data.data || []);
      } catch (err) {
        console.error("소셜 계정 조회 오류:", err);
        setError("계정 정보를 불러오는데 실패했습니다");
      }
    };

    fetchConnectedAccounts();
  }, [userId]);

  // 플랫폼 선택/해제 처리
  const handlePlatformToggle = (platform) => {
    if (selectedPlatforms.includes(platform)) {
      setSelectedPlatforms(selectedPlatforms.filter((p) => p !== platform));
    } else {
      setSelectedPlatforms([...selectedPlatforms, platform]);
    }
  };

  // 게시물 생성
  const handleGenerate = async () => {
    if (selectedPlatforms.length === 0) return;

    setIsGenerating(true);
    setError(null);

    try {
      const posts = {};

      // 선택한 플랫폼별로 게시물 생성
      for (const platform of selectedPlatforms) {
        const response = await socialMediaApi.generatePost(articleId, {
          platform,
          correctionId,
          options: {
            hasImage: false, // 필요시 이미지 포함 여부 설정
            userId,
          },
        });

        if (response.data.success) {
          posts[platform] = response.data.data;
        }
      }

      setGeneratedPosts(posts);
    } catch (err) {
      console.error("게시물 생성 오류:", err);
      setError("소셜 미디어 게시물 생성에 실패했습니다");
    } finally {
      setIsGenerating(false);
    }
  };

  // 게시물 게시
  const handlePublish = async () => {
    setIsPublishing(true);
    setError(null);

    try {
      const results = [];

      // 생성된 게시물 게시
      for (const platform of selectedPlatforms) {
        if (generatedPosts[platform]) {
          const response = await socialMediaApi.publishPost(
            generatedPosts[platform]._id,
            userId
          );

          if (response.data.success) {
            results.push(response.data.data);
          }
        }
      }

      if (results.length > 0) {
        alert(`${results.length}개의 소셜 미디어에 게시되었습니다.`);
        onClose();
      } else {
        setError("게시에 실패했습니다");
      }
    } catch (err) {
      console.error("게시 오류:", err);
      setError("게시 과정에서 오류가 발생했습니다");
    } finally {
      setIsPublishing(false);
    }
  };

  // 소셜 미디어 계정 연결
  const handleConnect = async () => {
    try {
      const { platform, accessToken, platformUserId, username } =
        newCredentials;

      if (!accessToken || !platformUserId) {
        setError("액세스 토큰과 사용자 ID는 필수입니다");
        return;
      }

      await socialMediaApi.connectAccount(platform, {
        accessToken,
        platformUserId,
        username,
        userId,
      });

      // 계정 목록 다시 로드
      await fetchConnectedAccounts();
      setShowConnectSection(false);

      // 입력 폼 초기화
      setNewCredentials({
        platform: "instagram",
        accessToken: "",
        platformUserId: "",
        username: "",
      });
    } catch (err) {
      console.error("계정 연결 오류:", err);
      setError(`계정 연결 실패: ${err.message}`);
    }
  };

  // 통계 보기
  const handleShowStatistics = (platform) => {
    setSelectedStatPlatform(platform);
    setShowStatistics(true);
  };

  // 모달 외부 클릭 시 닫기
  const handleOutsideClick = (e) => {
    if (e.target.className === "modal-overlay") {
      onClose();
    }
  };

  // 모달 탭 (연결/통계/공유)
  const renderModalContent = () => {
    if (showStatistics && selectedStatPlatform) {
      return (
        <div style={styles.statisticsContainer}>
          <h3 style={styles.sectionTitle}>
            <button
              onClick={() => setShowStatistics(false)}
              style={styles.backButton}
            >
              ←
            </button>
            {selectedStatPlatform} 통계
          </h3>
          <SocialStatsDashboard
            userId={userId}
            platform={selectedStatPlatform}
          />
        </div>
      );
    }

    if (showConnectSection) {
      return (
        <div style={styles.connectSection}>
          <h3 style={styles.sectionTitle}>새 계정 연결</h3>
          <select
            value={newCredentials.platform}
            onChange={(e) =>
              setNewCredentials({ ...newCredentials, platform: e.target.value })
            }
            style={styles.select}
          >
            <option value="instagram">Instagram</option>
            <option value="thread">Thread</option>
            <option value="facebook">Facebook</option>
            <option value="linkedin">LinkedIn</option>
          </select>

          <input
            type="text"
            placeholder="액세스 토큰"
            value={newCredentials.accessToken}
            onChange={(e) =>
              setNewCredentials({
                ...newCredentials,
                accessToken: e.target.value,
              })
            }
            style={styles.input}
          />

          <input
            type="text"
            placeholder="플랫폼 사용자 ID"
            value={newCredentials.platformUserId}
            onChange={(e) =>
              setNewCredentials({
                ...newCredentials,
                platformUserId: e.target.value,
              })
            }
            style={styles.input}
          />

          <input
            type="text"
            placeholder="사용자명 (선택사항)"
            value={newCredentials.username}
            onChange={(e) =>
              setNewCredentials({ ...newCredentials, username: e.target.value })
            }
            style={styles.input}
          />

          <div style={styles.buttonGroup}>
            <button onClick={handleConnect} style={styles.primaryButton}>
              연결
            </button>
            <button
              onClick={() => setShowConnectSection(false)}
              style={styles.secondaryButton}
            >
              취소
            </button>
          </div>
        </div>
      );
    }

    return (
      <>
        <div className="platform-selection" style={styles.section}>
          <h3 style={styles.sectionTitle}>공유할 플랫폼 선택</h3>
          {platforms.length === 0 ? (
            <div>
              <p style={styles.message}>연결된 소셜 미디어 계정이 없습니다.</p>
              <button
                onClick={() => setShowConnectSection(true)}
                style={styles.primaryButton}
              >
                소셜 미디어 계정 연결하기
              </button>
            </div>
          ) : (
            <div style={styles.platformList}>
              {platforms.map((platform) => (
                <div key={platform.id} style={styles.platformItem}>
                  <div style={styles.platformCheckbox}>
                    <input
                      type="checkbox"
                      id={platform.platform}
                      checked={selectedPlatforms.includes(platform.platform)}
                      onChange={() => handlePlatformToggle(platform.platform)}
                    />
                    <label
                      htmlFor={platform.platform}
                      style={styles.platformLabel}
                    >
                      {platform.platform} ({platform.username})
                    </label>
                  </div>
                  <button
                    onClick={() => handleShowStatistics(platform.platform)}
                    style={styles.statsButton}
                  >
                    통계
                  </button>
                </div>
              ))}
              <button
                onClick={() => setShowConnectSection(true)}
                style={styles.secondaryButton}
              >
                계정 추가
              </button>
            </div>
          )}
        </div>

        {selectedPlatforms.length > 0 &&
          !isGenerating &&
          Object.keys(generatedPosts).length === 0 && (
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              style={styles.primaryButton}
            >
              {isGenerating ? "생성 중..." : "게시물 생성하기"}
            </button>
          )}

        {Object.keys(generatedPosts).length > 0 && (
          <div className="generated-posts" style={styles.section}>
            <h3 style={styles.sectionTitle}>생성된 게시물 미리보기</h3>
            {selectedPlatforms.map(
              (platform) =>
                generatedPosts[platform] && (
                  <div key={platform} style={styles.postPreview}>
                    <h4 style={styles.platformName}>{platform}</h4>
                    <textarea
                      value={generatedPosts[platform]?.adaptedText || ""}
                      onChange={(e) => {
                        const updated = { ...generatedPosts };
                        updated[platform].adaptedText = e.target.value;
                        setGeneratedPosts(updated);
                      }}
                      style={styles.textarea}
                      rows={5}
                    />
                  </div>
                )
            )}

            <button
              onClick={handlePublish}
              disabled={isPublishing}
              style={styles.primaryButton}
            >
              {isPublishing ? "게시 중..." : "선택한 플랫폼에 게시하기"}
            </button>
          </div>
        )}
      </>
    );
  };

  return (
    <div
      className="modal-overlay"
      onClick={handleOutsideClick}
      style={styles.overlay}
    >
      <div className="modal-content" style={styles.content}>
        <h2 style={styles.title}>소셜 미디어 공유</h2>

        {error && <div style={styles.error}>{error}</div>}

        {renderModalContent()}

        <button onClick={onClose} style={styles.closeButton}>
          닫기
        </button>
      </div>
    </div>
  );
};

// 인라인 스타일
const styles = {
  overlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  content: {
    backgroundColor: "#fff",
    borderRadius: "4px",
    padding: "20px",
    width: "90%",
    maxWidth: "700px",
    maxHeight: "90vh",
    overflow: "auto",
    boxShadow: "0 2px 10px rgba(0, 0, 0, 0.2)",
  },
  title: {
    fontSize: "24px",
    marginTop: 0,
    marginBottom: "20px",
    color: "#333",
  },
  section: {
    marginBottom: "20px",
  },
  sectionTitle: {
    fontSize: "18px",
    marginTop: 0,
    marginBottom: "10px",
    color: "#333",
    display: "flex",
    alignItems: "center",
  },
  message: {
    color: "#666",
    fontStyle: "italic",
    marginBottom: "10px",
  },
  platformList: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  platformItem: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px",
    backgroundColor: "#f8f9fa",
    borderRadius: "4px",
  },
  platformLabel: {
    marginLeft: "8px",
    color: "#333",
  },
  postPreview: {
    marginBottom: "15px",
    padding: "10px",
    border: "1px solid #ddd",
    borderRadius: "4px",
  },
  platformName: {
    margin: "0 0 10px 0",
    color: "#333",
    fontSize: "16px",
    textTransform: "capitalize",
  },
  textarea: {
    width: "100%",
    padding: "8px",
    border: "1px solid #ddd",
    borderRadius: "4px",
    resize: "vertical",
    fontFamily: "inherit",
    fontSize: "14px",
  },
  primaryButton: {
    backgroundColor: "#007bff",
    color: "#fff",
    border: "none",
    borderRadius: "4px",
    padding: "10px 15px",
    fontSize: "14px",
    cursor: "pointer",
    marginRight: "10px",
    marginTop: "10px",
  },
  closeButton: {
    backgroundColor: "#6c757d",
    color: "#fff",
    border: "none",
    borderRadius: "4px",
    padding: "10px 15px",
    fontSize: "14px",
    cursor: "pointer",
  },
  error: {
    backgroundColor: "#f8d7da",
    color: "#721c24",
    padding: "10px",
    borderRadius: "4px",
    marginBottom: "15px",
  },
};

export default SocialShareModal;
