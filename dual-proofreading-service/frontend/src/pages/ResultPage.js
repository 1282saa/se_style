import React from "react";
import { useParams } from "react-router-dom";

const ResultPage = () => {
  const { articleId } = useParams();

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "2rem" }}>
      <h1>교정 결과</h1>
      <p>아티클 ID: {articleId}</p>
      <div style={{ marginTop: "2rem" }}>
        <h2>구현 중인 기능입니다</h2>
        <p>곧 교정 결과를 볼 수 있습니다.</p>
      </div>
    </div>
  );
};

export default ResultPage;
