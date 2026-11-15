import React from 'react';
import { DoseInstance, CareProfile } from '../types';
import { Info, Clock, AlertTriangle, ShieldCheck, Mail, X } from 'lucide-react';

interface ExplainAlertModalProps {
  dose: DoseInstance | null;
  profile: CareProfile;
  onClose: () => void;
}

export const ExplainAlertModal: React.FC<ExplainAlertModalProps> = ({ dose, profile, onClose }) => {
  if (!dose) return null;

  const scheduledTime = dose.local_scheduled_at.split('T')[1]?.slice(0, 5) || '13:00';
  const graceMinutes = dose.grace_period_minutes || profile.grace_period_minutes || 30;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center flex-shrink-0">
            <Info className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">Explain This Care Alert</span>
            <h2 className="text-2xl font-extrabold text-slate-900">Why was this alert generated?</h2>
          </div>
        </div>

        {/* Step-by-step explainability breakdown */}
        <div className="space-y-4 mb-6">
          
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-3">
            <Clock className="w-5 h-5 text-slate-500 flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-bold text-slate-500 uppercase">1. Scheduled Event</div>
              <p className="text-sm font-semibold text-slate-800 mt-0.5">
                {dose.medication_name} ({dose.dose_text}) was scheduled for <strong>{scheduledTime} ({profile.timezone})</strong>.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-bold text-slate-500 uppercase">2. Configurable Grace Period</div>
              <p className="text-sm font-semibold text-slate-800 mt-0.5">
                The care profile has a configured grace window of <strong>{graceMinutes} minutes</strong>.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-bold text-amber-900 uppercase">3. Escalation Policy Rule</div>
              <p className="text-sm text-amber-950 font-medium mt-0.5 leading-relaxed">
                When no confirmation is recorded by {scheduledTime} + {graceMinutes} mins, status moves from <code className="bg-amber-100 px-1.5 py-0.5 rounded text-amber-900 font-mono text-xs">DUE</code> to <code className="bg-amber-100 px-1.5 py-0.5 rounded text-amber-900 font-mono text-xs">OVERDUE_UNCONFIRMED</code>.
                Sahaaya Care automatically alerts authorized family contacts.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-3">
            <Mail className="w-5 h-5 text-teal-600 flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-bold text-slate-500 uppercase">4. Delivery Status & Recipients</div>
              <p className="text-sm font-semibold text-slate-800 mt-0.5">
                Transactional email dispatched to authorized Family Admin (<code>meera.rao@example.com</code>). Delivery state: <span className="text-emerald-700 font-bold">SENT / DELIVERED</span>.
              </p>
            </div>
          </div>

        </div>

        {/* Safety & Design Philosophy Note */}
        <div className="p-4 bg-teal-50/70 border border-teal-200 rounded-2xl text-xs text-teal-950 leading-relaxed mb-6">
          <strong>Key Healthcare Principle:</strong> <em>No acknowledgement recorded does NOT mean the dose was not taken.</em> It simply prompts a friendly family check-in without judgment or accusation.
        </div>

        <button
          onClick={onClose}
          className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 px-4 rounded-xl text-base transition-colors"
        >
          Got it
        </button>
      </div>
    </div>
  );
};
