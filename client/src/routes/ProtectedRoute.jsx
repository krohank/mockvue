import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PageLoader } from '../components/ui/Feedback';

export const ProtectedRoute = () => {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'checking') return <PageLoader label="Checking your session…" />;
  if (status !== 'authenticated') {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return <Outlet />;
};

/** Login/register: bounce signed-in users to where they were going. */
export const GuestRoute = () => {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'checking') return <PageLoader />;
  if (status === 'authenticated') {
    const to = location.state?.from?.pathname || '/dashboard';
    return <Navigate to={to} replace />;
  }
  return <Outlet />;
};
