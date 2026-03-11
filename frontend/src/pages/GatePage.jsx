import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

export default function GatePage({ onAuth }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!code.trim() || loading) return;

    setError('');
    setLoading(true);
    try {
      await api.post('/auth/verify', { code: code.trim() });
      onAuth();
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.response?.status === 401 ? 'Invalid invite code' : 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen px-4">
      <div className="w-full max-w-sm rounded-xl border border-white/10 bg-white/[0.03] p-8 backdrop-blur-sm shadow-2xl">
        <h1 className="text-3xl font-bold text-white text-center tracking-tight" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}>
          DebateForge
        </h1>
        <p className="mt-2 text-sm text-gray-500 text-center">
          AI-Powered Structured Debate Platform
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <input
            ref={inputRef}
            type="password"
            value={code}
            onChange={(e) => { setCode(e.target.value); setError(''); }}
            placeholder="Enter invite code"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-gray-600 outline-none transition-all focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30"
          />

          {error && (
            <p className="text-sm text-red-400 animate-[fadeIn_0.2s_ease-in]">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !code.trim()}
            className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                Verifying…
              </span>
            ) : 'Enter'}
          </button>
        </form>
      </div>
    </div>
  );
}
