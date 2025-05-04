import React from "react";
import { Link } from "react-router-dom";

const NotFoundPage = () => {
  return (
    <div
      style={{
        maxWidth: "1200px",
        margin: "0 auto",
        padding: "2rem",
        textAlign: "center",
      }}
    >
      <h1>404 - 페이지를 찾을 수 없습니다</h1>
      <p>요청하신 페이지가 존재하지 않습니다.</p>
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
        홈으로 돌아가기
      </Link>
    </div>
  );
};

export default NotFoundPage;
