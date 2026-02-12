
import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Navigation from './components/Navigation.tsx';
import JsonTool from './pages/JsonTool.tsx';
import LogAnalyzer from './pages/LogAnalyzer.tsx';

const App: React.FC = () => {
  return (
    <HashRouter>
      <div className="min-h-screen flex flex-col p-6 md:p-8 lg:p-10 max-w-[1800px] mx-auto animate-fade-in">
        {/* 導航標題 */}
        <Navigation />

        {/* 路由內容區域 */}
        <Routes>
          <Route path="/" element={<Navigate to="/jsonTool" replace />} />
          <Route path="/jsonTool" element={<JsonTool />} />
          <Route path="/logAnalyzer" element={<LogAnalyzer />} />
        </Routes>
      </div>
    </HashRouter>
  );
};

export default App;

