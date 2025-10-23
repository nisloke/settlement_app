import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';

const Login = () => {
  const [loading, setLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/dashboard';

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate(from, { replace: true });
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthLogin = async (provider) => {
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) {
      setError(error.message);
    }
  };

  const handleGuestLogin = async () => {
    setError(null);
    setGuestLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: import.meta.env.VITE_GUEST_USER_EMAIL,
        password: import.meta.env.VITE_GUEST_USER_PASSWORD,
      });
      if (error) throw error;
      navigate(from, { replace: true });
    } catch (error) {
      setError(error.message);
    } finally {
      setGuestLoading(false);
    }
  };

  return (
    <div className="relative flex justify-center items-center h-screen bg-gray-100 overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center z-10">
        <h1 className="font-thirthy text-7xl md:text-9xl font-extrabold text-gray-300 tracking-wider text-center select-none flex flex-col">
          <span>Gently</span>
          <span>Split</span>
          <span>the Bill</span>
          <span className="text-gray-400">FAST</span>
        </h1>
      </div>
      <div className="relative z-20 w-full max-w-md p-8 space-y-6 bg-white bg-opacity-25 backdrop-blur-sm rounded-lg shadow-lg">
        <h2 className="text-2xl font-bold text-center text-gray-800">로그인</h2>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="text-sm font-medium text-gray-700"
            >
              이메일
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 mt-1 text-gray-700 border rounded-md focus:outline-none focus:ring focus:ring-blue-200"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="text-sm font-medium text-gray-700"
            >
              비밀번호
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 mt-1 text-gray-700 border rounded-md focus:outline-none focus:ring focus:ring-blue-200"
              placeholder="••••••••"
            />
          </div>
          <div>
            <button
              type="submit"
              disabled={loading || guestLoading}
              className="w-full px-4 py-2 font-bold text-white bg-blue-500 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400"
            >
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </div>

          <div className="relative flex items-center justify-center">
            <div className="flex-grow border-t border-gray-300"></div>
            <span className="flex-shrink mx-4 text-sm text-gray-500">또는</span>
            <div className="flex-grow border-t border-gray-300"></div>
          </div>

          <div className="space-y-2">
            <button
              type="button"
              onClick={() => handleOAuthLogin('google')}
              className="w-full flex items-center justify-center px-4 py-2 font-bold text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:bg-gray-400"
            >
              <svg className="w-5 h-5 mr-3" xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                <path d="M1 1h22v22H1z" fill="none"/>
              </svg>
              Google로 로그인
            </button>
            <button
              type="button"
              onClick={() => handleOAuthLogin('kakao')}
              className="w-full flex items-center justify-center px-4 py-2 font-bold text-black bg-yellow-400 rounded-md hover:bg-yellow-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 disabled:bg-gray-400"
            >
              <svg className="w-5 h-5 mr-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2500 2500">
                <path fill="#3A1D1D" d="M1250,351.6c-560.9,0-1015.6,358.5-1015.6,800.8c0,285.9,190.1,536.8,476.1,678.5c-15.6,53.7-100,345.2-103.3,368.1c0,0-2,17.2,9.1,23.8c11.1,6.6,24.2,1.5,24.2,1.5c32-4.5,370.5-242.3,429.1-283.6c58.5,8.3,118.8,12.6,180.4,12.6c560.9,0,1015.6-358.5,1015.6-800.8C2265.6,710.1,1810.9,351.6,1250,351.6L1250,351.6z"/>
              </svg>
              카카오로 로그인
            </button>
          </div>

          <div className="relative flex items-center justify-center">
            <div className="flex-grow border-t border-gray-300"></div>
            <span className="flex-shrink mx-4 text-sm text-gray-500">또는</span>
            <div className="flex-grow border-t border-gray-300"></div>
          </div>

          <div>
            <button
              type="button"
              onClick={handleGuestLogin}
              disabled={loading || guestLoading}
              className="w-full px-4 py-2 font-bold text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:bg-gray-400"
            >
              {guestLoading ? '접속 중...' : '게스트로 둘러보기'}
            </button>
          </div>

          {error && <p className="text-sm text-center text-red-500">{error}</p>}
        </form>
      </div>
    </div>
  );
};

export default Login;
