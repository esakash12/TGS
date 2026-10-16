import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

interface User {
  id: number;
  username: string;
  email: string;
  role: string;
  tenant_id: string | null;
}

interface Tenant {
  id: string;
  name: string;
  slug: string;
  owner_email: string;
  bot_token?: string;
  bot_username?: string;
  wallet_usd: number;
  usd_to_bdt_rate: number;
  status: string;
}

interface AuthContextType {
  user: User | null;
  tenant: Tenant | null;
  token: string | null;
  isLoading: boolean;
  login: (token: string, user: User, tenant?: Tenant) => void;
  logout: () => void;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as any);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('mogent_token'));
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshSession = async () => {
    const savedToken = localStorage.getItem('mogent_token');
    if (!savedToken) {
      setIsLoading(false);
      return;
    }

    try {
      const res = await axios.get('/api/auth/me', {
        headers: { Authorization: `Bearer ${savedToken}` },
      });
      setUser(res.data.user);
      setTenant(res.data.tenant);
      setToken(savedToken);
    } catch (err) {
      console.error('Session validation failed:', err);
      logout();
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshSession();
  }, []);

  const login = (newToken: string, newUser: User, newTenant?: Tenant) => {
    localStorage.setItem('mogent_token', newToken);
    setToken(newToken);
    setUser(newUser);
    if (newTenant) setTenant(newTenant);
  };

  const logout = () => {
    localStorage.removeItem('mogent_token');
    setToken(null);
    setUser(null);
    setTenant(null);
  };

  return (
    <AuthContext.Provider value={{ user, tenant, token, isLoading, login, logout, refreshSession }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
