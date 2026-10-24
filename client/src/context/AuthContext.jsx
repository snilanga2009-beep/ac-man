import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [company, setCompany] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('acpro_token') || null);
  const [activeCompanyContext, setActiveCompanyContext] = useState(
    localStorage.getItem('acpro_context_company_id') || null
  );
  const [technicianPrice, setTechnicianPrice] = useState(2000);
  const [loading, setLoading] = useState(true);

  // Configure Axios defaults
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }

    if (activeCompanyContext && user?.role === 'SUPER_ADMIN') {
      axios.defaults.headers.common['x-company-context'] = activeCompanyContext;
    } else {
      delete axios.defaults.headers.common['x-company-context'];
    }
  }, [token, activeCompanyContext, user]);

  const fetchMe = async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const res = await axios.get('/api/auth/me');
      setUser(res.data.user);
      setCompany(res.data.company);
      if (res.data.default_technician_price) {
        setTechnicianPrice(res.data.default_technician_price);
      }
    } catch (err) {
      console.error('Failed to fetch auth session:', err);
      logout();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMe();
  }, [token, activeCompanyContext]);

  const login = async (username, password) => {
    const res = await axios.post('/api/auth/login', { username: String(username).trim(), password });
    const { token: newToken, user: newUser } = res.data;
    localStorage.setItem('acpro_token', newToken);
    axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    setToken(newToken);
    setUser(newUser);
    return newUser;
  };

  const requestTechnicianOtp = async (identifier, channel = 'SMS_WHATSAPP') => {
    const res = await axios.post('/api/auth/technician/request-otp', {
      identifier: String(identifier).trim(),
      channel
    });
    return res.data;
  };

  const verifyTechnicianOtp = async (identifier, otp_code) => {
    const res = await axios.post('/api/auth/technician/verify-otp', {
      identifier: String(identifier).trim(),
      otp_code: String(otp_code).trim()
    });
    const { token: newToken, user: newUser } = res.data;
    localStorage.setItem('acpro_token', newToken);
    axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    setToken(newToken);
    setUser(newUser);
    return newUser;
  };

  const logout = () => {
    localStorage.removeItem('acpro_token');
    localStorage.removeItem('acpro_context_company_id');
    setToken(null);
    setUser(null);
    setCompany(null);
    setActiveCompanyContext(null);
  };

  const switchCompanyContext = (companyId) => {
    if (companyId) {
      localStorage.setItem('acpro_context_company_id', String(companyId));
      setActiveCompanyContext(String(companyId));
    } else {
      localStorage.removeItem('acpro_context_company_id');
      setActiveCompanyContext(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        company,
        token,
        loading,
        technicianPrice,
        activeCompanyContext,
        login,
        requestTechnicianOtp,
        verifyTechnicianOtp,
        logout,
        switchCompanyContext,
        refreshSession: fetchMe
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
