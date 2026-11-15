import React, { useState } from 'react';
import { DoseInstance } from '../types';
import { CheckCircle2, XCircle, AlertCircle, RefreshCw, X } from 'lucide-react';
import { apiRequest } from '../api';

interface DoseModalProps {
  dose: DoseInstance | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const DoseModal: React.FC<DoseModalProps> = ({ dose, onClose, onSuccess }) => {
  if (!dose) return null;

  const [activeTab, setActiveTab] = useState<'take' | 'skip' | 'unable' | 'correct'>(
    dose.status === 'ACKNOWLEDGED_TAKEN' ? 'correct' : 'take'
  );
  const [note, setNote] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');
  const [newStatus, setNewStatus] = useState<string>('ACKNOWLEDGED_TAKEN');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAction = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      if (activeTab === 'take') {
        await apiRequest(`/doses/${dose.id}/acknowledge`, {
          method: 'POST',
          body: JSON.stringify({ note })
        });
      } else if (activeTab === 'skip') {
        await apiRequest(`/doses/${dose.id}/skip`, {
          method: 'POST',
          body: JSON.stringify({ reason: note || 'User skipped dose' })
        });
      } else if (activeTab === 'unable') {
        await apiRequest(`/doses/${dose.id}/unable-to-take`, {
          method: 'POST',
          body: JSON.stringify({ reason: note || 'Unable to take dose' })
        });
      } else if (activeTab === 'correct') {
        if (!correctionReason.trim()) {
          setError('A reason is mandatory when correcting or undoing an acknowledgement.');
          setIsSubmitting(false);
          return;
        }
        await apiRequest(`/doses/${dose.id}/correct-acknowledgement`, {
          method: 'POST',
          body: JSON.stringify({ newStatus, reason: correctionReason })
        });
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update dose status.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200 relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-6">
          <span className="text-xs font-bold text-teal-700 uppercase tracking-wider">Update Medication Status</span>
          <h2 className="text-2xl font-extrabold text-slate-900 mt-1">{dose.medication_name}</h2>
          <div className="text-sm text-slate-600">{dose.dose_text} • Scheduled: {dose.local_scheduled_at.split('T')[1]?.slice(0, 5)}</div>
          {dose.instructions && (
            <div className="mt-2 text-xs bg-teal-50 border border-teal-200 text-teal-900 p-2.5 rounded-xl font-medium">
              "{dose.instructions}"
            </div>
          )}
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-semibold">
            {error}
          </div>
        )}

        {/* Action Tabs */}
        <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-2xl mb-6 text-xs font-bold text-slate-600">
          <button
            onClick={() => setActiveTab('take')}
            className={`py-2 rounded-xl transition-all ${activeTab === 'take' ? 'bg-white text-emerald-800 shadow-sm' : 'hover:text-slate-900'}`}
          >
            Taken
          </button>
          <button
            onClick={() => setActiveTab('skip')}
            className={`py-2 rounded-xl transition-all ${activeTab === 'skip' ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-900'}`}
          >
            Skip
          </button>
          <button
            onClick={() => setActiveTab('unable')}
            className={`py-2 rounded-xl transition-all ${activeTab === 'unable' ? 'bg-white text-amber-800 shadow-sm' : 'hover:text-slate-900'}`}
          >
            Unable
          </button>
          <button
            onClick={() => setActiveTab('correct')}
            className={`py-2 rounded-xl transition-all ${activeTab === 'correct' ? 'bg-white text-teal-800 shadow-sm' : 'hover:text-slate-900'}`}
          >
            Correct
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'take' && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">Confirm that this dose was taken according to instructions.</p>
            <div>
              <label htmlFor="dose-take-note" className="block text-xs font-bold text-slate-700 uppercase mb-1">Optional Note</label>
              <input
                id="dose-take-note"
                type="text"
                placeholder="e.g. Taken with breakfast"
                value={note}
                onChange={e => setNote(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
              />
            </div>
            <button
              onClick={handleAction}
              disabled={isSubmitting}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3.5 px-4 rounded-xl shadow-sm flex items-center justify-center gap-2 text-base transition-transform active:scale-98"
            >
              <CheckCircle2 className="w-5 h-5" />
              <span>{isSubmitting ? 'Recording...' : 'Confirm Dose Taken'}</span>
            </button>
          </div>
        )}

        {activeTab === 'skip' && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">Record that this dose was intentionally skipped.</p>
            <div>
              <label htmlFor="dose-skip-reason" className="block text-xs font-bold text-slate-700 uppercase mb-1">Reason (Optional)</label>
              <input
                id="dose-skip-reason"
                type="text"
                placeholder="e.g. Advised to skip before lab test"
                value={note}
                onChange={e => setNote(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
              />
            </div>
            <button
              onClick={handleAction}
              disabled={isSubmitting}
              className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 text-base"
            >
              <XCircle className="w-5 h-5 text-slate-400" />
              <span>{isSubmitting ? 'Recording...' : 'Mark Skipped'}</span>
            </button>
          </div>
        )}

        {activeTab === 'unable' && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">Record that the person was unable to take the medicine (e.g. nausea, out of stock).</p>
            <div>
              <label htmlFor="dose-unable-reason" className="block text-xs font-bold text-slate-700 uppercase mb-1">Reason (Helpful for Care Circle)</label>
              <input
                id="dose-unable-reason"
                type="text"
                placeholder="e.g. Feeling nauseous / ran out of tablets"
                value={note}
                onChange={e => setNote(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
              />
            </div>
            <button
              onClick={handleAction}
              disabled={isSubmitting}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 text-base"
            >
              <AlertCircle className="w-5 h-5" />
              <span>{isSubmitting ? 'Recording...' : 'Record Unable to Take'}</span>
            </button>
          </div>
        )}

        {activeTab === 'correct' && (
          <div className="space-y-4">
            <div className="p-3 bg-teal-50 rounded-xl border border-teal-200 text-xs text-teal-900 leading-relaxed">
              <strong>Audit Guarantee:</strong> Corrections do not erase history. An auditable event is captured with before/after state and your reason.
            </div>
            <div>
              <label htmlFor="dose-correct-status" className="block text-xs font-bold text-slate-700 uppercase mb-1">New Intended Status</label>
              <select
                id="dose-correct-status"
                value={newStatus}
                onChange={e => setNewStatus(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm bg-white font-semibold"
              >
                <option value="ACKNOWLEDGED_TAKEN">Acknowledged Taken</option>
                <option value="ACKNOWLEDGED_SKIPPED">Acknowledged Skipped</option>
                <option value="UNABLE_TO_TAKE">Unable to Take</option>
                <option value="DUE">Due (Reset confirmation)</option>
                <option value="OVERDUE_UNCONFIRMED">Overdue / Unconfirmed</option>
              </select>
            </div>
            <div>
              <label htmlFor="dose-correct-reason" className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Correction Reason <span className="text-rose-600">*</span>
              </label>
              <input
                id="dose-correct-reason"
                type="text"
                placeholder="e.g. Tapped 'taken' by accident; was actually skipped"
                value={correctionReason}
                onChange={e => setCorrectionReason(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
              />
            </div>
            <button
              onClick={handleAction}
              disabled={isSubmitting}
              className="w-full bg-teal-700 hover:bg-teal-800 text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 text-base"
            >
              <RefreshCw className="w-5 h-5" />
              <span>{isSubmitting ? 'Updating...' : 'Save Audited Correction'}</span>
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
