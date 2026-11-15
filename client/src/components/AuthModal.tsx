import React, { useState } from 'react';
import { User } from '../types';
import { apiRequest, setAuthToken } from '../api';
import { KeyRound, UserCheck, Shield, Sparkles } from 'lucide-react';

interface AuthModalProps {
  onSuccess: (user: User) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onSuccess }) => {
  const [tab, setTab] = useState<'login' | 'register' | 'redeem'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('DemoPass123!');
  const [displayName, setDisplayName] = useState('');
  const [roleTitle, setRoleTitle] = useState('Family');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (tab === 'login') {
        const res = await apiRequest('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password })
        });
        setAuthToken(res.token);
        onSuccess(res.user);
      } else if (tab === 'register') {
        const res = await apiRequest('/auth/register', {
          method: 'POST',
          body: JSON.stringify({ email, password, displayName, roleTitle })
        });
        setAuthToken(res.token);
        // Automatically create a starter care profile for the new user
        await apiRequest('/care-profiles', {
          method: 'POST',
          body: JSON.stringify({ displayName: `${displayName}'s Care Profile` })
        });
        onSuccess(res.user);
      } else if (tab === 'redeem') {
        // First login or register, then redeem
        const res = await apiRequest('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password })
        });
        setAuthToken(res.token);
        await apiRequest('/invitations/redeem', {
          method: 'POST',
          body: JSON.stringify({ code: inviteCode })
        });
        onSuccess(res.user);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = async (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('DemoPass123!');
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: demoEmail, password: 'DemoPass123!' })
      });
      setAuthToken(res.token);
      onSuccess(res.user);
    } catch (err: any) {
      setError(err.message || 'Demo login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200">
        
        {/* Brand */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-teal-600 text-white text-3xl flex items-center justify-center mx-auto shadow-sm mb-3">
            🌿
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900">Welcome to Sahaaya Care</h1>
          <p className="text-xs text-slate-500 mt-1">Consent-First Elderly Care & Medication Coordination</p>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-2xl mb-6 text-xs font-bold text-slate-600">
          <button
            onClick={() => setTab('login')}
            className={`py-2 rounded-xl transition-all ${tab === 'login' ? 'bg-white text-teal-800 shadow-sm' : ''}`}
          >
            Sign In
          </button>
          <button
            onClick={() => setTab('register')}
            className={`py-2 rounded-xl transition-all ${tab === 'register' ? 'bg-white text-teal-800 shadow-sm' : ''}`}
          >
            Register
          </button>
          <button
            onClick={() => setTab('redeem')}
            className={`py-2 rounded-xl transition-all ${tab === 'redeem' ? 'bg-white text-teal-800 shadow-sm' : ''}`}
          >
            Redeem Invite
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {tab === 'register' && (
            <div>
              <label htmlFor="auth-display-name" className="block text-xs font-bold text-slate-700 uppercase mb-1">Your Full Name</label>
              <input
                id="auth-display-name"
                type="text"
                placeholder="e.g. Meera Rao"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                required
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
              />
            </div>
          )}

          <div>
            <label htmlFor="auth-email" className="block text-xs font-bold text-slate-700 uppercase mb-1">Email Address</label>
            <input
              id="auth-email"
              type="email"
              placeholder="e.g. anita.rao@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
            />
          </div>

          <div>
            <label htmlFor="auth-password" className="block text-xs font-bold text-slate-700 uppercase mb-1">Password</label>
            <input
              id="auth-password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
            />
          </div>

          {tab === 'redeem' && (
            <div>
              <label htmlFor="auth-invite-code" className="block text-xs font-bold text-teal-800 uppercase mb-1">Invitation Passcode</label>
              <input
                id="auth-invite-code"
                type="text"
                placeholder="e.g. SHY-XXXX"
                value={inviteCode}
                onChange={e => setInviteCode(e.target.value)}
                required
                className="w-full px-4 py-2.5 rounded-xl border-2 border-teal-500 font-mono text-center tracking-widest text-lg font-bold text-teal-950 focus:outline-none"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 bg-teal-600 hover:bg-teal-700 text-white font-extrabold py-3.5 px-4 rounded-xl shadow-sm text-sm transition-transform active:scale-98"
          >
            {loading ? 'Please wait...' : tab === 'login' ? 'Sign In' : tab === 'register' ? 'Create Account' : 'Redeem Passcode'}
          </button>
        </form>

        {/* Quick Demo Access for Hackathon Judges */}
        <div className="mt-6 pt-5 border-t border-slate-200">
          <div className="text-center text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5">
            Judge 1-Click Demo Login
          </div>
          <div className="grid grid-cols-1 gap-2">
            <button
              onClick={() => handleQuickDemo('anita.rao@example.com')}
              className="w-full py-2 px-3 rounded-xl bg-teal-50 hover:bg-teal-100 border border-teal-200 text-teal-900 font-bold text-xs flex items-center justify-between"
            >
              <span>👵 Anita Rao (Elder Owner)</span>
              <span className="text-[10px] text-teal-700 font-normal">Click to enter →</span>
            </button>
            <button
              onClick={() => handleQuickDemo('meera.rao@example.com')}
              className="w-full py-2 px-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-900 font-bold text-xs flex items-center justify-between"
            >
              <span>👩 Meera Rao (Family Admin)</span>
              <span className="text-[10px] text-indigo-700 font-normal">Click to enter →</span>
            </button>
            <button
              onClick={() => handleQuickDemo('ravi.patil@example.com')}
              className="w-full py-2 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-900 font-bold text-xs flex items-center justify-between"
            >
              <span>👨 Ravi Patil (Caretaker)</span>
              <span className="text-[10px] text-emerald-700 font-normal">Click to enter →</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
