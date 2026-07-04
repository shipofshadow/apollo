import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface Props {
  children: ReactNode;
  requiredRole?: 'client' | 'admin' | 'owner';
  /** When true, redirect any 'client' role to / (allow admin/manager/staff) */
  denyClientRole?: boolean;
}

export default function ProtectedRoute({ children, requiredRole, denyClientRole }: Props) {
  const { user } = useAuth();
  const location  = useLocation();

  if (!user) {
    return (
      <Navigate
        to={`/login?redirect=${encodeURIComponent(location.pathname)}`}
        replace
      />
    );
  }

  if (requiredRole) {
    const isAllowedRole = requiredRole === 'admin'
      ? user.role === 'admin' || user.role === 'owner'
      : user.role === requiredRole;

    if (!isAllowedRole) {
      return <Navigate to="/" replace />;
    }
  }

  if (denyClientRole && user.role === 'client') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

