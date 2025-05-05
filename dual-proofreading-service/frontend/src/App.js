import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import "./styles/App.css";

// 페이지 컴포넌트 임포트
import HomePage from "./pages/HomePage";
import ArticleFormPage from "./pages/ArticleFormPage";
import ResultPage from "./pages/ResultPage";
import HistoryPage from "./pages/HistoryPage";
import NotFoundPage from "./pages/NotFoundPage";
import ProofreadPage from "./pages/ProofreadPage";
import StyleGuideSearchPage from "./pages/StyleGuideSearchPage";

// 공통 컴포넌트 임포트
import Header from "./components/Header";
import Footer from "./components/Footer";

const App = () => {
  return (
    <Router>
      <div className="min-h-screen flex flex-col bg-gray-100">
        <Header />
        <main className="flex-grow">
          <Routes>
            <Route path="/" element={<ProofreadPage />} />
            <Route path="/home" element={<HomePage />} />
            <Route path="/corrections/:articleId" element={<ResultPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route
              path="/styleguide-search"
              element={<StyleGuideSearchPage />}
            />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </Router>
  );
};

export default App;
