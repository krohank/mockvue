import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Compass } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';
import { useDocumentTitle } from '../hooks/useAsync';

export const NotFoundPage = () => {
  useDocumentTitle('Page not found');
  const { isAuthenticated } = useAuth();
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-2 text-ink-2">
        <Compass className="h-7 w-7" aria-hidden="true" />
      </span>
      <p className="num mt-6 text-sm font-semibold text-accent-ink">404</p>
      <h1 className="display mt-1 text-3xl">This page doesn’t exist</h1>
      <p className="mt-2 text-ink-2">The link may be broken, or the interview may have been deleted.</p>
      <Button as={Link} to={isAuthenticated ? '/dashboard' : '/'} icon={ArrowLeft} className="mt-8">
        {isAuthenticated ? 'Back to dashboard' : 'Back to home'}
      </Button>
    </div>
  );
};

export default NotFoundPage;
