'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api, { TOKEN_KEY, tokenStorage } from '@/lib/api';
import { setDisplayCurrency, setDisplayTimeZone } from '@/lib/format';
import { APPROVER_ROLES, AUDITOR_ROLES, HR_ROLES, IT_ROLES } from '@/lib/constants';

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
      setDisplayTimeZone(res.data.company?.timezone);
      setDisplayCurrency(res.data.company?.currency);
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

  // HRMS and Chat can be open in different tabs: logging out (or in as someone else) in one applies to all
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== TOKEN_KEY || e.newValue === e.oldValue) return;
      if (!e.newValue) {
        setUser(null);
        window.location.href = '/login';
      } else {
        window.location.reload();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    tokenStorage.set(res.data.token);
    setDisplayTimeZone(res.data.user.company?.timezone);
    setDisplayCurrency(res.data.user.company?.currency);
    setUser(res.data.user);
    return res.data.user;
  };

  const logout = () => {
    tokenStorage.clear();
    setUser(null);
    window.location.href = '/login';
  };

  // A team lead with the "employee" role also acts as a manager -> ['employee', 'manager']
  const accessRoles = useMemo(() => (user ? user.accessRoles || [user.role] : []), [user]);
  const hasRole = useCallback((roles) => accessRoles.some((role) => roles.includes(role)), [accessRoles]);

  const value = useMemo(
    () => ({
      user,
      setUser,
      loading,
      login,
      logout,
      refreshUser: loadUser,
      accessRoles,
      hasRole,
      isHR: hasRole(HR_ROLES),
      isApprover: hasRole(APPROVER_ROLES),
      isAdmin: user?.role === 'admin',
      isQA: user?.role === 'qa',
      isAuditor: hasRole(AUDITOR_ROLES),
      isIT: hasRole(IT_ROLES),
      // Direct and total (direct + indirect) reportees
      team: user?.team || { direct: 0, all: 0 },
      // Modules the company switched on (Settings -> Modules)
      features: {
        payroll: user?.company?.features?.payroll !== false,
        workStatus: user?.company?.features?.workStatus !== false,
        chat: user?.company?.features?.chat !== false,
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, loading, loadUser, accessRoles, hasRole]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
