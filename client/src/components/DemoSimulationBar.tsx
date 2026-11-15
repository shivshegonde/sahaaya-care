import React, { useState, useEffect } from 'react';
import { RotateCcw, Clock, Zap, AlertTriangle, FastForward, Mail, CheckCircle2, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { apiRequest } from '../api';

interface DemoSimulationBarProps {
  currentProfileId?: string;
  onRefreshData: () => void;
  onQuickLogin: (email: string) => void;
  onOpenNotifications?: () => void;
}

export const DemoSimulationBar: React.FC<DemoSimulationBarProps> = ({
  currentProfileId,
  onRefreshData,
  onQuickLogin,
  onOpenNotifications
}) => {
  const [clockStatus, setClockStatus] = useState<any>(null);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [feedback, setFeedback] = useState<{
    text: string;
    type: 'success' | 'warning' | 'info';
    details?: string;
  } | null>(null);

  const fetchClock = async () => {
    try {
      const res = await apiRequest('/demo/clock');
      setClockStatus(res);
    } catch (e) {}
  };

  useEffect(() => {
    fetchClock();
  }, []);

  // Clear feedback after 12 seconds
  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(null), 12000);
    return () => clearTimeout(timer);
  }, [feedback]);

  const handleAdvance = async (minutes: number) => {
    setIsAdvancing(true);
    try {
      const res = await apiRequest('/demo/advance-time', {
        method: 'POST',
        body: JSON.stringify({ minutes, careProfileId: currentProfileId })
      });
      await fetchClock();
      onRefreshData();

      const msg = res.message || `Advanced clock by +${minutes} minutes.`;
      const isOverdue = res.dispatchResult?.totalOverdue > 0;
      setFeedback({
        text: msg,
        type: isOverdue ? 'warning' : 'success'
      });
    } catch (e: any) {
      setFeedback({ text: 'Error advancing clock: ' + e.message, type: 'warning' });
    } finally {
      setIsAdvancing(false);
    }
  };

  const handleFastForwardNextDose = async () => {
    setIsAdvancing(true);
    try {
      const res = await apiRequest('/demo/fast-forward-next-dose', {
        method: 'POST',
        body: JSON.stringify({ careProfileId: currentProfileId })
      });
      await fetchClock();
      onRefreshData();

      setFeedback({
        text: res.message || 'Fast-forwarded to next scheduled dose.',
        type: 'success'
      });
    } catch (e: any) {
      setFeedback({ text: 'Error: ' + e.message, type: 'warning' });
    } finally {
      setIsAdvancing(false);
    }
  };

  const handleTriggerGraceExpiry = async () => {
    setIsAdvancing(true);
    try {
      const res = await apiRequest('/demo/trigger-grace-period-expiry', {
        method: 'POST',
        body: JSON.stringify({ careProfileId: currentProfileId })
      });
      await fetchClock();
      onRefreshData();

      setFeedback({
        text: res.message || 'Advanced past grace period. Dose is now OVERDUE_UNCONFIRMED.',
        type: 'warning'
      });
    } catch (e: any) {
      setFeedback({ text: 'Error: ' + e.message, type: 'warning' });
    } finally {
      setIsAdvancing(false);
    }
  };

  const handleRunDispatcher = async () => {
    setIsAdvancing(true);
    try {
      const res = await apiRequest('/demo/run-dispatcher', {
        method: 'POST',
        body: JSON.stringify({ careProfileId: currentProfileId })
      });
      await fetchClock();
      onRefreshData();

      const dispatched = res.dispatchResult?.dispatchedCount || 0;
      const msg = res.message || (dispatched > 0
        ? `🔔 Dispatched ${dispatched} reminder(s) to care circle recipients!`
        : 'Checked all schedules: 0 pending reminders for this exact minute.');

      setFeedback({
        text: msg,
        type: dispatched > 0 ? 'success' : 'info'
      });
    } catch (e: any) {
      setFeedback({ text: 'Error: ' + e.message, type: 'warning' });
    } finally {
      setIsAdvancing(false);
    }
  };

  const handleReset = async () => {
    setIsAdvancing(true);
    try {
      await apiRequest('/demo/reset-clock', { method: 'POST' });
      await fetchClock();
      onRefreshData();
      setFeedback({
        text: '↺ Reset simulated clock back to current real-world time.',
        type: 'info'
      });
    } catch (e: any) {
      setFeedback({ text: 'Error resetting clock: ' + e.message, type: 'warning' });
    } finally {
      setIsAdvancing(false);
    }
  };

  if (isMinimized) {
    return (
      <div className="fixed bottom-3 right-3 z-40">
        <button
          onClick={() => setIsMinimized(false)}
          className="bg-slate-900 text-teal-300 border border-teal-500/50 px-3.5 py-2 rounded-2xl shadow-2xl text-xs font-bold flex items-center gap-2 hover:bg-slate-800 transition-transform active:scale-95"
        >
          <Clock className="w-4 h-4 text-teal-400" />
          <span>Judge Demo Bar ▲</span>
          {clockStatus?.isOffsetActive && (
            <span className="bg-amber-500 text-slate-950 px-1.5 py-0.2 rounded-full text-[10px] font-extrabold">
              +{clockStatus.offsetMinutes}m
            </span>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-md text-white border-t border-teal-500/30 py-2 sm:py-2.5 px-3 sm:px-6 shadow-2xl transition-all">
      <div className="max-w-7xl mx-auto space-y-2">
        
        {/* Dynamic Judge Feedback Toast / Banner */}
        {feedback && (
          <div
            role="status"
            aria-live="polite"
            className={`p-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-2 ${
              feedback.type === 'warning'
                ? 'bg-amber-950/80 border-amber-500/60 text-amber-200'
                : feedback.type === 'success'
                ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-200'
                : 'bg-teal-950/80 border-teal-500/60 text-teal-200'
            }`}
          >
            <div className="flex items-center gap-2 flex-1">
              {feedback.type === 'warning' ? (
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
              ) : feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              ) : (
                <Clock className="w-4 h-4 text-teal-400 flex-shrink-0" />
              )}
              <span className="leading-snug">{feedback.text}</span>
            </div>

            <div className="flex items-center gap-2">
              {onOpenNotifications && (
                <button
                  type="button"
                  onClick={onOpenNotifications}
                  className="underline hover:text-white font-bold text-[11px] flex items-center gap-1 bg-white/10 px-2 py-0.5 rounded-lg"
                >
                  <Mail className="w-3 h-3" />
                  <span>Inspect Dispatched Email</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setFeedback(null)}
                className="text-slate-400 hover:text-white text-xs px-1"
                aria-label="Dismiss message"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Main Demo Controls Bar */}
        <div className="flex flex-col lg:flex-row items-center justify-between gap-2.5 text-xs">
          
          {/* Left: Demo Clock Status & Minimize */}
          <div className="flex items-center justify-between w-full lg:w-auto gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-xl bg-teal-500/20 text-teal-300 flex items-center justify-center font-bold flex-shrink-0 border border-teal-500/30">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-teal-300 uppercase tracking-wider text-[11px] sm:text-xs">
                    Judge Demo Bar
                  </span>
                  {clockStatus?.isOffsetActive && (
                    <span className="bg-amber-500 text-slate-950 px-1.5 py-0.2 rounded-full text-[10px] font-extrabold">
                      +{clockStatus.offsetMinutes}m Offset
                    </span>
                  )}
                </div>
                <div className="text-slate-400 font-mono text-[10px] sm:text-[11px]">
                  Simulated: <strong className="text-white">{clockStatus?.simulatedTime ? new Date(clockStatus.simulatedTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '...'}</strong>
                </div>
              </div>
            </div>

            <button
              onClick={() => setIsMinimized(true)}
              title="Minimize demo bar"
              className="lg:hidden text-slate-400 hover:text-white p-1 rounded-lg text-xs"
            >
              ▼ Hide
            </button>
          </div>

          {/* Center: Fast Actions for Hackathon Evaluation */}
          <div className="flex items-center flex-wrap justify-center gap-1.5 sm:gap-2">
            
            {/* 1-Click Jump to Next Scheduled Dose */}
            <button
              type="button"
              onClick={handleFastForwardNextDose}
              disabled={isAdvancing}
              title="Jump simulated time directly to next scheduled dose so it becomes DUE NOW"
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-extrabold flex items-center gap-1.5 shadow-sm transition-transform active:scale-95 disabled:opacity-50"
            >
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>Jump to Next Dose</span>
            </button>

            {/* 1-Click Grace Period Escalation Trigger */}
            <button
              type="button"
              onClick={handleTriggerGraceExpiry}
              disabled={isAdvancing}
              title="Advance past the 30-min grace period to trigger multi-tier family escalation"
              className="px-3 py-1.5 rounded-xl bg-rose-900/60 hover:bg-rose-800 border border-rose-500/60 text-rose-200 font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              <span>Expire Grace Period (+35m)</span>
            </button>

            {/* Incremental Steppers */}
            <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => handleAdvance(15)}
                disabled={isAdvancing}
                className="px-2 py-1 rounded-lg hover:bg-slate-800 text-slate-300 font-bold transition-colors"
              >
                +15m
              </button>
              <button
                type="button"
                onClick={() => handleAdvance(30)}
                disabled={isAdvancing}
                className="px-2 py-1 rounded-lg hover:bg-slate-800 text-slate-300 font-bold transition-colors"
              >
                +30m
              </button>
              <button
                type="button"
                onClick={() => handleAdvance(60)}
                disabled={isAdvancing}
                className="px-2 py-1 rounded-lg hover:bg-slate-800 text-slate-300 font-bold transition-colors"
              >
                +1h
              </button>
            </div>

            {/* Manual Sweep / Check Due Reminders */}
            <button
              type="button"
              onClick={handleRunDispatcher}
              disabled={isAdvancing}
              title="Evaluate schedules and dispatch due reminder outbox"
              className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold flex items-center gap-1.5 shadow-sm transition-transform active:scale-95 disabled:opacity-50"
            >
              <Clock className="w-3.5 h-3.5 text-teal-200" />
              <span>{isAdvancing ? 'Checking...' : 'Check Due Reminders'}</span>
            </button>

            {/* Reset to Real Clock */}
            <button
              type="button"
              onClick={handleReset}
              disabled={isAdvancing}
              title="Reset simulated clock back to current wall-clock time"
              className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-400 hover:text-white transition-colors"
              aria-label="Reset simulated time"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            {/* Open Notifications Modal from Demo Bar */}
            {onOpenNotifications && (
              <button
                type="button"
                onClick={onOpenNotifications}
                title="Open verified notification delivery logs"
                className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-teal-300 font-bold flex items-center gap-1.5 transition-colors"
              >
                <Mail className="w-3.5 h-3.5" />
                <span className="hidden xl:inline">Email Log</span>
              </button>
            )}

          </div>

          {/* Right: Quick Persona Switcher */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-semibold hidden xl:inline">Persona:</span>
            <button
              type="button"
              onClick={() => onQuickLogin('anita.rao@example.com')}
              className="px-2 py-1 rounded-lg bg-teal-950/80 hover:bg-teal-900 border border-teal-700/80 text-teal-200 font-bold text-[11px] transition-colors"
            >
              👵 Anita
            </button>
            <button
              type="button"
              onClick={() => onQuickLogin('meera.rao@example.com')}
              className="px-2 py-1 rounded-lg bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-700/80 text-indigo-200 font-bold text-[11px] transition-colors"
            >
              👩 Meera
            </button>
            <button
              type="button"
              onClick={() => onQuickLogin('ravi.patil@example.com')}
              className="px-2 py-1 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700/80 text-emerald-200 font-bold text-[11px] transition-colors"
            >
              👨 Ravi
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
