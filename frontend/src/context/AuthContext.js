'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api, { tokenStorage } from '@/lib/api';
import { APPROVER_ROLES, HR_ROLES } from '@/lib/constants';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load the logged-in user from the saved token on first render
  const loadUser = useCallback(async () => {
    if (!tokenStorage.get()) {
      setLoading(false);
      return;
    }
    try {
      const res = await api.get('/auth/me');
      setUser(res.data);
    } catch {
      tokenStorage.clear();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    tokenStorage.set(res.data.token);
    setUser(res.data.user);
    return res.data.user;
  };

  const logout = () => {
    tokenStorage.clear();
    setUser(null);
    window.location.href = '/login';
  };

  const value = useMemo(
    () => ({
      user,
      setUser,
      loading,
      login,
      logout,
      refreshUser: loadUser,
      isHR: Boolean(user && HR_ROLES.includes(user.role)),
      isApprover: Boolean(user && APPROVER_ROLES.includes(user.role)),
      isAdmin: user?.role === 'admin',
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, loading, loadUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
