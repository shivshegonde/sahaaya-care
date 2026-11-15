import React from 'react';
import { User, CareProfile, Membership } from '../types';
import { Sparkles, Bell, Contrast, LogOut, Shield, HeartHandshake, AlertCircle } from 'lucide-react';

interface NavbarProps {
  user: User | null;
  activeProfile: CareProfile | null;
  membership: Membership | null;
  viewMode: 'elder' | 'family';
  setViewMode: (mode: 'elder' | 'family') => void;
  isHighContrast: boolean;
  toggleHighContrast: () => void;
  onOpenAssistant: () => void;
  onOpenNotifications: () => void;
  onOpenHelp: () => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  activeProfile,
  membership,
  viewMode,
  setViewMode,
  isHighContrast,
  toggleHighContrast,
  onOpenAssistant,
  onOpenNotifications,
  onOpenHelp,
  onLogout
}) => {
  const roleLabel = membership?.role === 'ELDER_OWNER'
    ? 'Elder Owner'
    : membership?.role === 'CARETAKER'
    ? 'Caretaker'
    : membership?.role === 'FAMILY_ADMIN'
    ? 'Family Admin'
    : membership?.role === 'CARE_COORDINATOR'
    ? 'Coordinator'
    : 'Family Member';

  const userInitials = (user?.displayName || 'User')
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-xs transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-18">
          
          {/* Left: Brand Identity & Active Profile */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-teal-600 to-emerald-600 flex items-center justify-center text-white text-xl sm:text-2xl shadow-sm flex-shrink-0">
              🌿
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-900 leading-tight">
                  Sahaaya Care
                </span>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200/70 tracking-wide uppercase">
                  Consent-First
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium leading-tight">
                {activeProfile ? `Care Profile: ${activeProfile.display_name}` : 'Medication & Care Coordination'}
              </p>
            </div>
          </div>

          {/* Center: Sleek Segmented View Switcher */}
          {user && (
            <div className="hidden md:flex items-center bg-slate-100/90 p-1 rounded-2xl border border-slate-200/90 shadow-2xs">
              <button
                type="button"
                onClick={() => setViewMode('elder')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  viewMode === 'elder'
                    ? 'bg-white text-teal-900 shadow-xs border border-slate-200 font-extrabold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
                aria-pressed={viewMode === 'elder'}
              >
                <span>👵</span>
                <span>Senior View</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('family')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  viewMode === 'family'
                    ? 'bg-white text-teal-900 shadow-xs border border-slate-200 font-extrabold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
                aria-pressed={viewMode === 'family'}
              >
                <span>👨‍👩‍👧</span>
                <span>Family Portal</span>
              </button>
            </div>
          )}

          {/* Right: Controls & Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            
            {/* High Contrast Accessibility Toggle */}
            <button
              type="button"
              onClick={toggleHighContrast}
              title={isHighContrast ? 'Switch to standard view' : 'Enable WCAG 2.2 AAA High Contrast mode'}
              aria-label="Toggle high contrast accessibility mode"
              className={`p-2 rounded-xl border transition-all flex items-center gap-1 text-xs font-semibold ${
                isHighContrast
                  ? 'bg-amber-400 text-slate-950 border-amber-500 shadow-xs font-bold'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200 hover:text-slate-900'
              }`}
            >
              <Contrast className="w-4 h-4" />
              <span className="hidden xl:inline">{isHighContrast ? 'Normal' : 'High Contrast'}</span>
            </button>

            {/* Ask Sahaaya AI Assistant */}
            {user && (
              <button
                type="button"
                onClick={onOpenAssistant}
                title="Open grounded care assistant"
                className="bg-gradient-to-r from-teal-700 to-emerald-700 hover:from-teal-800 hover:to-emerald-800 text-white font-bold text-xs sm:text-sm px-3.5 py-2 rounded-xl shadow-xs flex items-center gap-1.5 transition-transform active:scale-95"
              >
                <Sparkles className="w-4 h-4 text-teal-200" />
                <span className="hidden sm:inline">Ask Sahaaya</span>
              </button>
            )}

            {/* Notification Inspector Bell */}
            {user && (
              <button
                type="button"
                onClick={onOpenNotifications}
                title="View verified notification dispatches and email deliveries"
                aria-label="Notifications & delivery inspector"
                className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 relative transition-colors"
              >
                <Bell className="w-4 h-4" />
                <span className="absolute 1.5 top-1.5 right-1.5 w-2 h-2 bg-teal-500 rounded-full ring-2 ring-white"></span>
              </button>
            )}

            {/* Emergency One-Tap Help */}
            {user && (
              <button
                type="button"
                onClick={onOpenHelp}
                className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs px-2.5 sm:px-3 py-2 rounded-xl flex items-center gap-1.5 transition-colors"
                title="Request check-in from care circle"
              >
                <AlertCircle className="w-4 h-4 text-rose-600" />
                <span className="hidden lg:inline">I Need Help</span>
              </button>
            )}

            {/* User Profile Capsule */}
            {user && (
              <div className="flex items-center gap-2 bg-slate-50/90 hover:bg-slate-100 p-1 pl-2 sm:pl-2.5 rounded-2xl border border-slate-200/90 transition-colors ml-1">
                <div className="hidden sm:block text-right">
                  <div className="text-xs font-bold text-slate-900 leading-tight truncate max-w-[120px]">
                    {user.displayName}
                  </div>
                  <div className="text-[10px] text-teal-700 font-semibold leading-tight">
                    {roleLabel}
                  </div>
                </div>

                <div className="w-7 h-7 rounded-xl bg-teal-100 text-teal-800 font-extrabold text-xs flex items-center justify-center flex-shrink-0">
                  {userInitials}
                </div>

                <button
                  type="button"
                  onClick={onLogout}
                  title="Sign out of Sahaaya Care"
                  aria-label="Sign out"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-white transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

          </div>

        </div>

        {/* Mobile View Switcher (segmented bar below header on screens < md) */}
        {user && (
          <div className="flex md:hidden items-center justify-center pb-2 pt-0.5">
            <div className="flex items-center w-full max-w-sm bg-slate-100 p-1 rounded-2xl border border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode('elder')}
                className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  viewMode === 'elder'
                    ? 'bg-white text-teal-900 shadow-xs border border-slate-200 font-extrabold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>👵</span>
                <span>Senior View</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('family')}
                className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  viewMode === 'family'
                    ? 'bg-white text-teal-900 shadow-xs border border-slate-200 font-extrabold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>👨‍👩‍👧</span>
                <span>Family Portal</span>
              </button>
            </div>
          </div>
        )}

      </div>
    </header>
  );
};
