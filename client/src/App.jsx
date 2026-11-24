import React from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AppLayout } from './components/layout/AppLayout';
import { LandingPage } from './pages/LandingPage';
import { LoginPage, RegisterPage } from './pages/AuthPages';
import { NotFoundPage } from './pages/NotFoundPage';

import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { DashboardPage } from './pages/DashboardPage';
import { ProfilePage } from './pages/ProfilePage';
import { CreateInterviewPage } from './pages/CreateInterviewPage';
import { InterviewPrepPage } from './pages/InterviewPrepPage';
import { InterviewRoom } from './pages/InterviewRoom';
import { InterviewResultsPage } from './pages/InterviewResultsPage';
import { HistoryPage } from './pages/HistoryPage';
import { AnalyticsPage } from './pages/AnalyticsPage';

export const App = () => {
  return (
    <ErrorBoundary><ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AppLayout />}>
              {/* Public Routes */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />

              {/* Protected Candidate Routes */}
              <Route element={<ProtectedRoute />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
                <Route path="/history" element={<HistoryPage />} />
                <Route path="/interviews/new" element={<CreateInterviewPage />} />
                <Route path="/interviews/:id/prep" element={<InterviewPrepPage />} />
                <Route path="/interviews/:id/room" element={<InterviewRoom />} />
                <Route path="/interviews/:id/results" element={<InterviewResultsPage />} />
              </Route>

              {/* 404 Routing */}
              <Route path="/404" element={<NotFoundPage />} />
              <Route path="*" element={<Navigate to="/404" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider></ErrorBoundary>
  );
};

export default App;
