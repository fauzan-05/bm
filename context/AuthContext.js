'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  getToken,
  setToken,
  removeToken,
  getStoredUser,
  setStoredUser,
  removeStoredUser,
  api,
} from '@/lib/api';
const EMPTY_MASTER_DATA = { categories: [], brands: [], units: [], sizes: [], colors: [], mainCats: [], subcats: [] };

const AuthContext = createContext({
  user: null,
  token: '',
  loading: true,
  isLoggedIn: false,
  login: () => {},
  logout: () => {},
  masterData: EMPTY_MASTER_DATA,
  refreshMasterData: async () => {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setTokenState] = useState('');
  const [loading, setLoading] = useState(true);
  const [masterData, setMasterData] = useState(EMPTY_MASTER_DATA);

  const router = useRouter();
  const pathname = usePathname();

  const refreshMasterData = useCallback(async () => {
    const currentToken = getToken();
    if (!currentToken) {
      setMasterData(EMPTY_MASTER_DATA);
      return;
    }

    try {
      const [catRes, brandRes, unitRes, sizeRes, colorRes, mainCatRes] =
        await Promise.allSettled([
          api('GET', '/categories'),
          api('GET', '/admin/brands'),
          api('GET', '/units'),
          api('GET', '/admin/sizes'),
          api('GET', '/admin/colors'),
          api('GET', '/admin/main-categories'),
        ]);

      const categories = catRes.status === 'fulfilled' ? catRes.value.categories || [] : [];
      const brands = brandRes.status === 'fulfilled' ? brandRes.value.brands || [] : [];
      const units = unitRes.status === 'fulfilled' ? unitRes.value.units || [] : [];
      const sizes = sizeRes.status === 'fulfilled' ? sizeRes.value.sizes || [] : [];
      const colors = colorRes.status === 'fulfilled' ? colorRes.value.colors || [] : [];
      const mainCats = mainCatRes.status === 'fulfilled' ? mainCatRes.value.main_categories || [] : [];

      // load subcategories
      let subcats = [];
      if (categories.length > 0) {
        const subRes = await Promise.allSettled(
          categories.map((c) =>
            api('GET', `/categories/${c.id}/subcategories`).catch(() => ({ subcategories: [] }))
          )
        );

        subcats = subRes.flatMap((r, i) => {
          if (r.status === 'fulfilled' && r.value.subcategories) {
            return r.value.subcategories.map((s) => ({
              ...s,
              category_name: categories[i]?.name || '',
            }));
          }
          return [];
        });
      }

      setMasterData({ categories, brands, units, sizes, colors, mainCats, subcats });
    } catch (e) {
      console.error('Failed to load master data from backend:', e);
      setMasterData(EMPTY_MASTER_DATA);
    }
  }, []);

  useEffect(() => {
    let savedToken = getToken();
    let savedUser = getStoredUser();

    // Remove the demo token persisted by older builds so the user must
    // authenticate against the backend with a real token.
    if (savedToken === 'demo-admin-token') {
      removeToken();
      removeStoredUser();
      savedToken = '';
      savedUser = null;
    }

    setTokenState(savedToken);
    setUser(savedUser);
    refreshMasterData().finally(() => setLoading(false));
  }, [refreshMasterData]);

  useEffect(() => {
    if (!loading) {
      const isAuthPage = pathname === '/login';
      if (!token && !isAuthPage) {
        router.push('/login');
      } else if (token && isAuthPage) {
        router.push('/');
      }
    }
  }, [loading, token, pathname, router]);

  const login = (newToken, newUser) => {
    setToken(newToken);
    setStoredUser(newUser);
    setTokenState(newToken);
    setUser(newUser);
    refreshMasterData();
    router.push('/');
  };

  const logout = () => {
    removeToken();
    removeStoredUser();
    setTokenState('');
    setUser(null);
    setMasterData(EMPTY_MASTER_DATA);
    router.push('/login');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isLoggedIn: !!token,
        login,
        logout,
        masterData,
        refreshMasterData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
