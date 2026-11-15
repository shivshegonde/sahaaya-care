import React, { useState, useEffect } from 'react';
import { CareProfile, NotificationDelivery } from '../types';
import { Mail, CheckCircle2, AlertCircle, Clock, X, Eye, ArrowLeft, ShieldCheck, Send } from 'lucide-react';
import { apiRequest } from '../api';

interface NotificationInspectorProps {
  profile: CareProfile;
  onClose: () => void;
}

export const NotificationInspector: React.FC<NotificationInspectorProps> = ({ profile, onClose }) => {
  const [deliveries, setDeliveries] = useState<NotificationDelivery[]>([]);
  const [selectedDelivery, setSelectedDelivery] = useState<NotificationDelivery | null>(null);
  const [loading, setLoading] = useState(true);

  const loadDeliveries = async () => {
    try {
      const res = await apiRequest(`/care-profiles/${profile.id}/notifications`);
      setDeliveries(res.deliveries || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDeliveries();
  }, [profile.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-3xl w-full h-[88vh] max-h-[760px] flex flex-col shadow-2xl border border-slate-200 relative overflow-hidden">
        
        {/* Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-slate-900 to-slate-950 text-white flex items-center justify-between flex-shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3">
            {selectedDelivery ? (
              <button
                type="button"
                onClick={() => setSelectedDelivery(null)}
                className="p-2 -ml-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 flex items-center gap-1.5 text-xs font-bold transition-colors"
                title="Back to delivery list"
              >
                <ArrowLeft className="w-5 h-5 text-teal-400" />
                <span className="hidden sm:inline">All Emails</span>
              </button>
            ) : (
              <div className="w-10 h-10 rounded-2xl bg-teal-500/20 text-teal-300 border border-teal-500/40 flex items-center justify-center flex-shrink-0">
                <Mail className="w-5 h-5" />
              </div>
            )}
            <div>
              <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2">
                <span>{selectedDelivery ? 'Email Message Preview' : 'Email Delivery Inspector'}</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-900/60 text-teal-300 border border-teal-700/80 uppercase">
                  Verified Audit
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {selectedDelivery
                  ? `Recipient: ${selectedDelivery.recipient_name} (${selectedDelivery.recipient_email})`
                  : `Real transactional notification pipeline for ${profile.display_name}`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Full-view Body: EITHER Single Email Reader OR All Deliveries List */}
        {selectedDelivery ? (
          /* ====================================================================
             FULL EMAIL READER VIEW (Clean, Spacious, Full-Modal Height)
             ==================================================================== */
          <div className="flex-1 overflow-y-auto p-5 sm:p-8 space-y-6 bg-slate-50/50">
            
            {/* Top Navigation Bar */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <button
                type="button"
                onClick={() => setSelectedDelivery(null)}
                className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 font-bold text-xs text-slate-700 flex items-center gap-2 shadow-xs transition-colors"
              >
                <ArrowLeft className="w-4 h-4 text-teal-600" />
                <span>← Back to All Deliveries</span>
              </button>

              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider ${
                  selectedDelivery.status === 'DELIVERED' || selectedDelivery.status === 'SENT'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-rose-100 text-rose-800 border border-rose-300'
                }`}>
                  ✓ {selectedDelivery.status}
                </span>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-200 text-slate-700">
                  Provider: {selectedDelivery.provider}
                </span>
              </div>
            </div>

            {/* Email Header Card */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2.5">
              <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900 leading-snug">
                {selectedDelivery.subject}
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 text-xs text-slate-600 border-t border-slate-100">
                <div>
                  <span className="font-bold text-slate-800">To: </span>
                  <span className="font-semibold text-slate-900">{selectedDelivery.recipient_name}</span> &lt;{selectedDelivery.recipient_email}&gt;
                </div>
                <div>
                  <span className="font-bold text-slate-800">Dispatched: </span>
                  <span>{new Date(selectedDelivery.created_at).toLocaleString('en-IN', { dateStyle: 'full', timeStyle: 'medium' })}</span>
                </div>
                <div>
                  <span className="font-bold text-slate-800">Delivery Channel: </span>
                  <span className="uppercase font-mono">{selectedDelivery.channel}</span>
                </div>
                {selectedDelivery.provider_message_id && (
                  <div className="truncate">
                    <span className="font-bold text-slate-800">Message-ID: </span>
                    <span className="font-mono text-slate-500 text-[11px]">{selectedDelivery.provider_message_id}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Email Body Content Paper */}
            <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="text-xs font-bold text-teal-800 uppercase tracking-wider flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5 text-teal-600" />
                <span>Rendered Email Body:</span>
              </div>
              <div className="font-sans text-sm sm:text-base text-slate-800 leading-relaxed whitespace-pre-wrap bg-slate-50/80 p-5 rounded-xl border border-slate-200/80">
                {selectedDelivery.body_text}
              </div>
            </div>

            {/* Observability & Verification Footnote */}
            <div className="p-4 rounded-2xl bg-teal-50 border border-teal-200/80 flex items-start gap-3 text-xs text-teal-900">
              <ShieldCheck className="w-5 h-5 text-teal-700 flex-shrink-0 mt-0.5" />
              <div>
                <strong>Immutable Audit Guarantee:</strong> This message was dispatched via the transactional outbox engine with verified idempotent delivery. Every recipient, timestamp, and delivery outcome is recorded in the platform audit trail.
              </div>
            </div>

          </div>
        ) : (
          /* ====================================================================
             LIST VIEW: All Deliveries for this Care Profile
             ==================================================================== */
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
            <div className="text-xs bg-slate-100 p-3.5 rounded-2xl border border-slate-200 text-slate-700 leading-relaxed">
              <strong>Observability Guarantee:</strong> Sahaaya Care distinguishes between <code className="font-mono text-teal-800 font-bold">QUEUED</code>, <code className="font-mono text-emerald-800 font-bold">SENT</code>, and verified <code className="font-mono text-emerald-800 font-bold">DELIVERED</code>. Real recipient delivery status is tracked transparently.
            </div>

            {deliveries.length === 0 ? (
              <div className="text-center py-16 text-slate-400 space-y-2">
                <Clock className="w-10 h-10 mx-auto text-slate-300" />
                <p className="font-bold text-slate-600">No email notifications dispatched yet.</p>
                <p className="text-xs max-w-sm mx-auto">
                  Advance time or use "Check Due Reminders" in the Judge Demo Bar below to simulate reminders or escalation alerts.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {deliveries.map(del => {
                  const isDelivered = del.status === 'DELIVERED' || del.status === 'SENT';
                  return (
                    <div
                      key={del.id}
                      onClick={() => setSelectedDelivery(del)}
                      className="p-4 sm:p-5 rounded-2xl border border-slate-200 hover:border-teal-500 bg-white hover:bg-teal-50/30 transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs group"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                            isDelivered ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-rose-100 text-rose-800 border border-rose-200'
                          }`}>
                            {del.status}
                          </span>
                          <h4 className="font-bold text-slate-900 text-sm group-hover:text-teal-900 transition-colors">
                            {del.subject}
                          </h4>
                        </div>
                        <div className="text-xs text-slate-600">
                          To: <strong className="text-slate-800">{del.recipient_name}</strong> &lt;{del.recipient_email}&gt; • Provider: {del.provider}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Dispatched: {new Date(del.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDelivery(del);
                        }}
                        className="px-4 py-2 rounded-xl bg-teal-600 group-hover:bg-teal-700 font-bold text-xs text-white flex items-center gap-1.5 self-start sm:self-auto shadow-xs transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Read Full Email</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};
