import React, { useState, useEffect } from 'react';
import { CareProfile, CareNote, Membership } from '../types';
import { FileText, Plus, ArrowLeft, Send, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import { apiRequest } from '../api';

interface CareJournalProps {
  profile: CareProfile;
  membership: Membership | null;
  initialTab?: 'journal' | 'handover';
  onBack: () => void;
}

export const CareJournal: React.FC<CareJournalProps> = ({ profile, membership, initialTab = 'journal', onBack }) => {
  const [activeTab, setActiveTab] = useState<'journal' | 'handover'>(initialTab);
  const [notes, setNotes] = useState<CareNote[]>([]);
  const [handover, setHandover] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // New Note State
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<'GENERAL' | 'APPOINTMENT' | 'MEDICATION_OBSERVATION' | 'FOLLOW_UP'>('GENERAL');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canAddNote = membership?.role === 'ELDER_OWNER' || membership?.permissions.includes('CARE_NOTE_CREATE');

  const loadData = async () => {
    try {
      const [notesRes, handoverRes] = await Promise.all([
        apiRequest(`/care-profiles/${profile.id}/notes`),
        apiRequest(`/care-profiles/${profile.id}/handover`)
      ]);
      setNotes(notesRes.notes || []);
      setHandover(handoverRes.handover || null);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [profile.id]);

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    setIsSubmitting(true);
    try {
      await apiRequest(`/care-profiles/${profile.id}/notes`, {
        method: 'POST',
        body: JSON.stringify({ body, category, visibility: 'ALL_MEMBERS' })
      });
      setBody('');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to save note.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 pb-16 max-w-4xl mx-auto">
      
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="text-slate-600 hover:text-slate-900 font-bold text-sm flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </button>

        {/* Tab Switcher */}
        <div className="flex items-center bg-slate-200/80 p-1 rounded-2xl text-xs font-bold">
          <button
            onClick={() => setActiveTab('journal')}
            className={`px-4 py-2 rounded-xl transition-all ${
              activeTab === 'journal' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Care Journal & Notes
          </button>
          <button
            onClick={() => setActiveTab('handover')}
            className={`px-4 py-2 rounded-xl transition-all ${
              activeTab === 'handover' ? 'bg-teal-700 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            ✨ Smart Shift Handover
          </button>
        </div>
      </div>

      {activeTab === 'journal' ? (
        <div className="space-y-6">
          
          {/* Header */}
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-teal-100 text-teal-800 flex items-center justify-center flex-shrink-0">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                Care Journal & Daily Observations
              </h1>
              <p className="text-slate-600 text-sm mt-1">
                Collaborative notes between family members, caretakers, and {profile.display_name}.
              </p>
            </div>
          </div>

          {/* Add Note Card */}
          {canAddNote && (
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <form onSubmit={handleCreateNote} className="space-y-3">
                <div className="flex items-center justify-between">
                  <label htmlFor="journal-body" className="text-xs font-bold text-slate-700 uppercase">New Observation / Care Update</label>
                  <select
                    id="journal-category"
                    aria-label="Note category"
                    value={category}
                    onChange={e => setCategory(e.target.value as any)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-300 bg-white"
                  >
                    <option value="GENERAL">General Update</option>
                    <option value="MEDICATION_OBSERVATION">Medication Observation</option>
                    <option value="APPOINTMENT">Appointment / Clinic Note</option>
                    <option value="FOLLOW_UP">Action Required / Follow-up</option>
                  </select>
                </div>

                <textarea
                  id="journal-body"
                  placeholder="Record an update e.g. Anita had breakfast on time, blood pressure was 124/80, garden walk completed..."
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  rows={3}
                  className="w-full p-4 rounded-2xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                />

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isSubmitting || !body.trim()}
                    className="bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-sm transition-transform active:scale-95 disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                    <span>{isSubmitting ? 'Posting...' : 'Post Care Note'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Notes Feed */}
          <div className="space-y-3">
            {notes.map(note => (
              <div key={note.id} className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                  <span className="font-bold text-slate-800 text-sm">{note.author_name || 'Care Circle Member'}</span>
                  <span>{new Date(note.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                </div>
                <p className="text-slate-800 text-sm leading-relaxed">{note.body}</p>
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                    {note.category.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>
            ))}
          </div>

        </div>
      ) : (
        /* Smart Shift Handover Summary */
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-teal-900 to-slate-900 text-white p-6 sm:p-8 rounded-3xl shadow-sm border border-teal-800">
            <span className="text-xs font-bold text-teal-400 uppercase tracking-wider">Caretaker Shift Briefing</span>
            <h1 className="text-2xl sm:text-3xl font-extrabold mt-1">Smart Care Handover Summary</h1>
            <p className="text-teal-200 text-sm mt-1">
              Grounded, verifiable record of the past 24 hours to ensure seamless continuity of care.
            </p>
          </div>

          {handover && (
            <div className="space-y-6">
              
              {/* Past 24h Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-2xl border border-slate-200 text-center">
                  <div className="text-xs text-slate-500 font-bold uppercase">Scheduled Doses</div>
                  <div className="text-2xl font-extrabold text-slate-900 mt-1">{handover.past24hStats.totalScheduled}</div>
                </div>
                <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-200 text-center">
                  <div className="text-xs text-emerald-800 font-bold uppercase">Confirmed Taken</div>
                  <div className="text-2xl font-extrabold text-emerald-900 mt-1">{handover.past24hStats.takenCount}</div>
                </div>
                <div className="bg-slate-100 p-4 rounded-2xl border border-slate-200 text-center">
                  <div className="text-xs text-slate-600 font-bold uppercase">Skipped</div>
                  <div className="text-2xl font-extrabold text-slate-800 mt-1">{handover.past24hStats.skippedCount}</div>
                </div>
                <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200 text-center">
                  <div className="text-xs text-amber-800 font-bold uppercase">Unconfirmed</div>
                  <div className="text-2xl font-extrabold text-amber-900 mt-1">{handover.past24hStats.unconfirmedCount}</div>
                </div>
              </div>

              {/* Outstanding Unconfirmed Doses */}
              {handover.unconfirmedDoses.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-3xl p-6">
                  <h3 className="text-lg font-bold text-amber-950 flex items-center gap-2 mb-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                    <span>Requires Next Shift Follow-up</span>
                  </h3>
                  <div className="space-y-2">
                    {handover.unconfirmedDoses.map((dose: any) => (
                      <div key={dose.id} className="bg-white p-3 rounded-xl border border-amber-200 text-sm font-semibold text-slate-900 flex justify-between">
                        <span>{dose.medication_name}</span>
                        <span className="text-xs text-amber-800 font-bold">Scheduled: {dose.local_scheduled_at.split('T')[1]?.slice(0, 5)} (Unconfirmed)</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Upcoming Doses in Next Shift */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200">
                <h3 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-teal-600" />
                  <span>Upcoming Doses for Incoming Caregiver</span>
                </h3>
                <div className="space-y-2">
                  {handover.upcomingDosesSummary.map((dose: any) => (
                    <div key={dose.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-sm">
                      <span className="font-bold text-slate-900">{dose.medication_name}</span>
                      <span className="text-xs text-slate-600 font-semibold">{dose.local_scheduled_at.split('T')[1]?.slice(0, 5)}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}
        </div>
      )}

    </div>
  );
};
