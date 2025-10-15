
import React, { useState } from 'react';
import { supabase } from '../supabaseClient';

const Login = () => {
  const [loading, setLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
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
        <form onSubmit={handleLogin} className="space-y-6">
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
