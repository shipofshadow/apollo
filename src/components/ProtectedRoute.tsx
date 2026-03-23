import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';

interface Props {
  children: ReactNode;
  requiredRole?: 'client' | 'admin';
}

export default function ProtectedRoute({ children, requiredRole }: Props) {
  const { user } = useSelector((s: RootState) => s.auth);
  const location = useLocation();

  if (!user) {
    return (
      <Navigate
        to={`/login?redirect=${encodeURIComponent(location.pathname)}`}
        replace
      />
    );
  }

  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
