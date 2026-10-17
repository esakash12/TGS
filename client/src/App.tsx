import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Landing } from './pages/Landing';
import { Register } from './pages/Register';
import { Login } from './pages/Login';
import { Dashboard } from './pages/admin/Dashboard';
import { OnboardingPlan } from './pages/OnboardingPlan';
import { GodMode } from './pages/godmode/GodMode';
import { useAuth } from './context/AuthContext';
import { GODMODE_SECRET_PATH } from '../../shared/constants';

const ProtectedAuthRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-carbon-950 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-crimson-500 border-t-transparent animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const ProtectedDashboardRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, tenant, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-carbon-950 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-crimson-500 border-t-transparent animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Strict Paywall Gate: Merchant cannot enter dashboard without an active paid subscription
  const isSubActive = tenant?.subscription_status === 'ACTIVE' &&
    (!tenant?.subscription_expires_at || new Date(tenant.subscription_expires_at).getTime() > Date.now());

  if (user.role === 'merchant_admin' && !isSubActive) {
    return <Navigate to="/onboarding/plan" replace />;
  }

  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <Routes>
      {/* Public Landing */}
      <Route path="/" element={<Landing />} />

      {/* Merchant Registration & Login */}
      <Route path="/register" element={<Register />} />
      <Route path="/login" element={<Login />} />

      {/* SaaS Plan Selection & Onboarding (Requires Login) */}
      <Route
        path="/onboarding/plan"
        element={
          <ProtectedAuthRoute>
            <OnboardingPlan />
          </ProtectedAuthRoute>
        }
      />

      {/* Protected Merchant Control Center (Strictly requires active subscription) */}
      <Route
        path="/admin/*"
        element={
          <ProtectedDashboardRoute>
            <Dashboard />
          </ProtectedDashboardRoute>
        }
      />

      {/* Secret Super Admin God-Mode */}
      <Route path={GODMODE_SECRET_PATH} element={<GodMode />} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
