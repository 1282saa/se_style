import React from "react";
import { Link } from "react-router-dom";

const Header = () => {
  return (
    <header
      style={{
        backgroundColor: "#212529",
        color: "white",
        padding: "1rem 2rem",
      }}
    >
      <nav
        style={{
          display: "flex",
          justifyContent: "space-between",
          maxWidth: "1200px",
          margin: "0 auto",
        }}
      >
        <Link
          to="/"
          style={{
            fontSize: "1.5rem",
            fontWeight: "bold",
            color: "white",
            textDecoration: "none",
          }}
        >
          맞춤형 교정 시스템
        </Link>
        <div style={{ display: "flex", gap: "1.5rem" }}>
          <Link to="/" style={{ color: "white", textDecoration: "none" }}>
            교정하기
          </Link>
          <Link
            to="/history"
            style={{ color: "white", textDecoration: "none" }}
          >
            교정 내역
          </Link>
          <Link
            to="/styleguide-search"
            style={{ color: "white", textDecoration: "none" }}
          >
            스타일 검색
          </Link>
        </div>
      </nav>
    </header>
  );
};

export default Header;
