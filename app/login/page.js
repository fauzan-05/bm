'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';

export default function LoginPage() {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { login } = useAuth();
  const { showToast } = useToast();

  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    setError('');

    const cleanPhone = phone.trim();
    if (!cleanPhone || cleanPhone.length !== 10) {
      setError('Enter a valid 10-digit phone number');
      return;
    }

    setLoading(true);

    try {
      if (!otpSent) {
        await api('POST', '/auth/admin-login', { phone: cleanPhone });
        setOtpSent(true);
        showToast('OTP sent', 'success');
      } else {
        const cleanOtp = otp.trim();
        if (!cleanOtp) {
          setError('Enter OTP');
          setLoading(false);
          return;
        }

        const data = await api('POST', '/auth/admin-login', { phone: cleanPhone, otp: cleanOtp });
        if (!data?.token) throw new Error('Backend did not return an authentication token');

        showToast('Logged in successfully', 'success');
        login(data.token, data.user || null);
      }
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleLogin(e);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-logo">
          <div className="logo-badge" style={{ width: '56px', height: '56px', borderRadius: '14px', margin: '0 auto 12px' }}>
            <img src="/logo.png" alt="BetterMend" className="logo-img" />
          </div>
          <img
            src="/logo-wordmark-navy.png"
            alt="BetterMend Urban Services"
            style={{ height: '28px', maxWidth: '210px', width: 'auto', objectFit: 'contain', margin: '0 auto 8px', display: 'block' }}
          />
          <p>Product Management Portal</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleLogin} onKeyDown={handleKeyDown}>
          <div className="form-group" style={{ marginBottom: '14px' }}>
            <label>Admin Phone</label>
            <input
              type="tel"
              placeholder="10-digit phone number"
              maxLength={10}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={loading || otpSent}
              autoFocus
            />
          </div>

          {otpSent && (
            <div className="form-group" style={{ marginBottom: '14px' }}>
              <label>OTP</label>
              <input
                type="text"
                placeholder="Enter OTP"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                disabled={loading}
                autoFocus
              />
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary btn-full"
            disabled={loading}
            style={{ marginTop: '10px' }}
          >
            {loading
              ? 'Please wait…'
              : otpSent
                ? 'Verify OTP'
                : 'Send OTP'}
          </button>
        </form>

        {otpSent && (
          <button
            type="button"
            className="btn btn-outline btn-full btn-sm"
            style={{ marginTop: '10px' }}
            onClick={() => {
              setOtpSent(false);
              setOtp('');
              setError('');
            }}
          >
            Change Phone Number
          </button>
        )}
      </div>
    </div>
  );
}
