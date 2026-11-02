import React, { lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { AppLayout, FocusLayout } from './components/layout/AppLayout';
import { ProtectedRoute, GuestRoute } from './routes/ProtectedRoute';
import { LandingPage } from './pages/LandingPage';
import { NotFoundPage } from './pages/NotFoundPage';

// Route-level code splitting: the computer-vision runtime and charts only load when needed.
const LoginPage = lazy(() => import('./pages/AuthPages').then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('./pages/AuthPages').then((m) => ({ default: m.RegisterPage })));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
const HistoryPage = lazy(() => import('./pages/HistoryPage'));
const CreateInterviewPage = lazy(() => import('./pages/CreateInterviewPage'));
const InterviewPrepPage = lazy(() => import('./pages/InterviewPrepPage'));
const InterviewRoom = lazy(() => import('./pages/InterviewRoom'));
const InterviewResultsPage = lazy(() => import('./pages/InterviewResultsPage'));

export const App = () => (
  <ThemeProvider>
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<LandingPage />} />
              <Route element={<GuestRoute />}>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
              </Route>
              <Route element={<ProtectedRoute />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
                <Route path="/history" element={<HistoryPage />} />
                <Route path="/interviews/new" element={<CreateInterviewPage />} />
                <Route path="/interviews/:id/prep" element={<InterviewPrepPage />} />
                <Route path="/interviews/:id/results" element={<InterviewResultsPage />} />
              </Route>
              <Route path="*" element={<NotFoundPage />} />
            </Route>
            <Route element={<FocusLayout />}>
              <Route element={<ProtectedRoute />}>
                <Route path="/interviews/:id/room" element={<InterviewRoom />} />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  </ThemeProvider>
);

export default App;
