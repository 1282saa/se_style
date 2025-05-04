import React from "react";
import { Link } from "react-router-dom";

const HomePage = () => {
  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "2rem" }}>
      <h1>맞춤형 교정 시스템</h1>
      <p>기사 텍스트를 입력하고 맞춤형 교정 결과를 받아보세요.</p>
      <Link
        to="/"
        style={{
          display: "inline-block",
          backgroundColor: "#007bff",
          color: "white",
          padding: "0.5rem 1rem",
          borderRadius: "4px",
          textDecoration: "none",
          marginTop: "1rem",
        }}
      >
        교정하기
      </Link>
    </div>
  );
};

export default HomePage;
