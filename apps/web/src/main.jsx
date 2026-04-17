import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import CasesPage from './pages/CasesPage';
import CaseDetailPage from './pages/CaseDetailPage';
import KnowledgeGraphPage from './pages/KnowledgeGraphPage';
import FactCheckerPage from './pages/FactCheckerPage';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <CasesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/cases/:caseId"
            element={
              <ProtectedRoute>
                <CaseDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/cases/:caseId/knowledge-graph"
            element={
              <ProtectedRoute>
                <KnowledgeGraphPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/cases/:caseId/fact-check"
            element={
              <ProtectedRoute>
                <FactCheckerPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);

