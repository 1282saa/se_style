import React, { useState, useEffect } from "react";
import { socialMediaApi } from "../services/api";

/**
 * 소셜 미디어 통계 대시보드 컴포넌트
 * @param {Object} props - 컴포넌트 속성
 * @param {string} props.userId - 사용자 ID
 * @param {string} props.platform - 소셜 미디어 플랫폼 (instagram, thread 등)
 */
const SocialStatsDashboard = ({ userId, platform }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    // 통계 데이터 로딩
    const loadStatistics = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await socialMediaApi.getStatistics(userId, platform);

        if (response.data.success) {
          setStats(response.data.data[platform] || null);
        } else {
          throw new Error(
            response.data.message || "통계 정보를 불러오지 못했습니다"
          );
        }
      } catch (err) {
        console.error("통계 로딩 오류:", err);
        setError(
          err.message || "통계 데이터를 불러오는 중 오류가 발생했습니다"
        );
      } finally {
        setLoading(false);
      }
    };

    if (userId && platform) {
      loadStatistics();
    }
  }, [userId, platform]);

  if (loading) {
    return <div style={styles.loading}>통계 로딩 중...</div>;
  }

  if (error) {
    return <div style={styles.error}>{error}</div>;
  }

  if (!stats) {
    return <div style={styles.message}>통계 정보가 없습니다</div>;
  }

  const renderInstagramStats = () => {
    const { total_posts, post_types, popular_hashtags, peak_posting_hours } =
      stats;

    return (
      <div>
        <div style={styles.statCard}>
          <h3 style={styles.cardTitle}>게시물 개요</h3>
          <p>
            총 게시물 수: <strong>{total_posts}</strong>
          </p>
        </div>

        <div style={styles.statCard}>
          <h3 style={styles.cardTitle}>게시물 유형</h3>
          <div style={styles.barChart}>
            {Object.entries(post_types || {}).map(([type, count]) => (
              <div key={type} style={styles.barChartItem}>
                <div style={styles.barLabel}>{type}</div>
                <div style={styles.barContainer}>
                  <div
                    style={{
                      ...styles.bar,
                      width: `${(count / total_posts) * 100}%`,
                    }}
                  />
                </div>
                <div style={styles.barValue}>{count}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={styles.statCard}>
          <h3 style={styles.cardTitle}>인기 해시태그</h3>
          <div style={styles.tagContainer}>
            {(popular_hashtags || []).map(([tag, count], index) => (
              <div key={index} style={styles.tag}>
                #{tag} <span style={styles.tagCount}>{count}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={styles.statCard}>
          <h3 style={styles.cardTitle}>인기 게시 시간대</h3>
          <div style={styles.peakHours}>
            {(peak_posting_hours || []).map(([hour, count], index) => (
              <div key={index} style={styles.hourItem}>
                <div style={styles.hour}>{hour}시</div>
                <div style={styles.hourBar}>
                  <div
                    style={{
                      ...styles.hourBarFill,
                      width: `${Math.min(
                        (count / (total_posts || 1)) * 300,
                        100
                      )}%`,
                    }}
                  />
                </div>
                <div style={styles.hourCount}>{count}회</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderThreadStats = () => {
    const { total_threads, engagement, post_types } = stats;

    return (
      <div>
        <div style={styles.statCard}>
          <h3 style={styles.cardTitle}>스레드 개요</h3>
          <p>
            총 게시물 수: <strong>{total_threads}</strong>
          </p>
        </div>

        <div style={styles.statCard}>
          <h3 style={styles.cardTitle}>인게이지먼트</h3>
          <div style={styles.engagementGrid}>
            <div style={styles.engagementItem}>
              <span style={styles.engagementValue}>
                {engagement?.views || 0}
              </span>
              <span style={styles.engagementLabel}>조회수</span>
            </div>
            <div style={styles.engagementItem}>
              <span style={styles.engagementValue}>
                {engagement?.likes || 0}
              </span>
              <span style={styles.engagementLabel}>좋아요</span>
            </div>
            <div style={styles.engagementItem}>
              <span style={styles.engagementValue}>
                {engagement?.replies || 0}
              </span>
              <span style={styles.engagementLabel}>답글</span>
            </div>
            <div style={styles.engagementItem}>
              <span style={styles.engagementValue}>
                {engagement?.reposts || 0}
              </span>
              <span style={styles.engagementLabel}>리포스트</span>
            </div>
            <div style={styles.engagementItem}>
              <span style={styles.engagementValue}>
                {engagement?.quotes || 0}
              </span>
              <span style={styles.engagementLabel}>인용</span>
            </div>
          </div>
        </div>

        <div style={styles.statCard}>
          <h3 style={styles.cardTitle}>게시물 유형</h3>
          <div style={styles.barChart}>
            {Object.entries(post_types || {}).map(([type, count]) => (
              <div key={type} style={styles.barChartItem}>
                <div style={styles.barLabel}>{type}</div>
                <div style={styles.barContainer}>
                  <div
                    style={{
                      ...styles.bar,
                      width: `${(count / (total_threads || 1)) * 100}%`,
                    }}
                  />
                </div>
                <div style={styles.barValue}>{count}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={styles.container}>
      {platform === "instagram" && renderInstagramStats()}
      {platform === "thread" && renderThreadStats()}
      {!["instagram", "thread"].includes(platform) && (
        <div style={styles.message}>
          아직 이 플랫폼의 상세 통계를 지원하지 않습니다.
        </div>
      )}
    </div>
  );
};

// 인라인 스타일
const styles = {
  container: {
    padding: "10px",
  },
  loading: {
    padding: "20px",
    textAlign: "center",
    color: "#666",
  },
  error: {
    padding: "15px",
    backgroundColor: "#f8d7da",
    color: "#721c24",
    borderRadius: "4px",
    marginBottom: "20px",
  },
  message: {
    padding: "20px",
    textAlign: "center",
    color: "#666",
    fontStyle: "italic",
  },
  statCard: {
    backgroundColor: "#f8f9fa",
    borderRadius: "4px",
    padding: "15px",
    marginBottom: "15px",
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
  },
  cardTitle: {
    margin: "0 0 10px 0",
    fontSize: "16px",
    color: "#333",
  },
  barChart: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  barChartItem: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  barLabel: {
    width: "100px",
    fontSize: "14px",
    color: "#555",
  },
  barContainer: {
    flex: 1,
    height: "20px",
    backgroundColor: "#e9ecef",
    borderRadius: "4px",
    overflow: "hidden",
  },
  bar: {
    height: "100%",
    backgroundColor: "#4dabf7",
    transition: "width 0.3s ease",
  },
  barValue: {
    width: "40px",
    textAlign: "right",
    fontSize: "14px",
    color: "#555",
  },
  tagContainer: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
  },
  tag: {
    display: "inline-flex",
    alignItems: "center",
    backgroundColor: "#e7f5ff",
    color: "#1971c2",
    padding: "5px 10px",
    borderRadius: "4px",
    fontSize: "14px",
  },
  tagCount: {
    marginLeft: "5px",
    backgroundColor: "#1971c2",
    color: "white",
    padding: "2px 6px",
    borderRadius: "10px",
    fontSize: "12px",
  },
  peakHours: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  hourItem: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  hour: {
    width: "50px",
    fontSize: "14px",
    color: "#555",
  },
  hourBar: {
    flex: 1,
    height: "20px",
    backgroundColor: "#e9ecef",
    borderRadius: "4px",
    overflow: "hidden",
  },
  hourBarFill: {
    height: "100%",
    backgroundColor: "#82c91e",
    transition: "width 0.3s ease",
  },
  hourCount: {
    width: "50px",
    textAlign: "right",
    fontSize: "14px",
    color: "#555",
  },
  engagementGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "10px",
  },
  engagementItem: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "10px",
    backgroundColor: "#e7f5ff",
    borderRadius: "4px",
  },
  engagementValue: {
    fontSize: "24px",
    fontWeight: "bold",
    color: "#1c7ed6",
  },
  engagementLabel: {
    fontSize: "12px",
    color: "#555",
    marginTop: "5px",
  },
};

export default SocialStatsDashboard;
