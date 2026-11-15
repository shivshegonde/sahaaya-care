import React, { useState, useEffect } from 'react';
import { CareProfile, Medication, Membership } from '../types';
import { Pill, Plus, Pause, Play, Archive, ArrowLeft, ShieldAlert, Clock, Check } from 'lucide-react';
import { apiRequest } from '../api';

interface MedicationManagerProps {
  profile: CareProfile;
  membership: Membership | null;
  onBack: () => void;
}

export const MedicationManager: React.FC<MedicationManagerProps> = ({ profile, membership, onBack }) => {
  const [medications, setMedications] = useState<Medication[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(true);

  // New medication form state
  const [name, setName] = useState('');
  const [doseText, setDoseText] = useState('');
  const [form, setForm] = useState('Tablet');
  const [instructions, setInstructions] = useState('');
  const [time1, setTime1] = useState('08:00');
  const [time2, setTime2] = useState('');
  const [prescriber, setPrescriber] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canEdit = membership?.role === 'ELDER_OWNER' || membership?.permissions.includes('MEDICATION_CREATE');

  const loadMeds = async () => {
    try {
      const res = await apiRequest(`/care-profiles/${profile.id}/medications`);
      setMedications(res.medications || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMeds();
  }, [profile.id]);

  const handleAddMed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !doseText) return;
    setIsSubmitting(true);
    try {
      const times = [time1];
      if (time2) times.push(time2);

      await apiRequest(`/care-profiles/${profile.id}/medications`, {
        method: 'POST',
        body: JSON.stringify({
          name,
          doseText,
          form,
          instructions,
          scheduleType: 'FIXED_TIMES',
          scheduleConfig: { times },
          startDate,
          prescriber
        })
      });

      setShowAddModal(false);
      setName('');
      setDoseText('');
      setInstructions('');
      loadMeds();
    } catch (err: any) {
      alert(err.message || 'Failed to add medication.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (med: Medication) => {
    try {
      const endpoint = med.status === 'ACTIVE' ? `/medications/${med.id}/pause` : `/medications/${med.id}/archive`;
      await apiRequest(endpoint, { method: 'POST' });
      loadMeds();
    } catch (err: any) {
      alert(err.message || 'Failed to update status.');
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

        {canEdit && (
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm px-4 py-2.5 rounded-xl shadow-sm flex items-center gap-2 transition-transform active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Add Medication Routine</span>
          </button>
        )}
      </div>

      {/* Safety Notice Banner */}
      <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs sm:text-sm flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
        <div>
          <strong>Prescription Safety Principle:</strong> Instructions and schedules in Sahaaya Care are entered verbatim from official prescription labels. AI and automated systems never infer, recommend, or modify dose amounts or frequencies.
        </div>
      </div>

      {/* Medications List */}
      <div className="space-y-4">
        {medications.map(med => {
          const times = med.schedule_config?.times || ['09:00'];
          const isActive = med.status === 'ACTIVE';

          return (
            <div
              key={med.id}
              className={`p-6 rounded-3xl border transition-all ${
                isActive ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-100 border-slate-300 opacity-70'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                    isActive ? 'bg-teal-100 text-teal-800' : 'bg-slate-200 text-slate-500'
                  }`}>
                    <Pill className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-xl font-bold text-slate-900">{med.name}</h3>
                      <span className="text-sm font-semibold text-slate-500">({med.dose_text})</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                      }`}>
                        {med.status}
                      </span>
                    </div>

                    {med.instructions && (
                      <p className="text-sm text-slate-700 font-medium mt-1">
                        Instruction: <span className="italic">"{med.instructions}"</span>
                      </p>
                    )}

                    <div className="flex flex-wrap gap-4 mt-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1 font-semibold text-teal-800">
                        <Clock className="w-4 h-4" />
                        Times: {times.join(', ')}
                      </span>
                      <span>Form: {med.form}</span>
                      {med.prescriber && <span>Doctor: {med.prescriber}</span>}
                      <span>Version: v{med.version}</span>
                    </div>
                  </div>
                </div>

                {canEdit && (
                  <div className="flex items-center gap-2 self-start">
                    {isActive ? (
                      <button
                        onClick={() => handleToggleStatus(med)}
                        className="px-3 py-1.5 rounded-xl border border-slate-300 hover:bg-slate-100 font-bold text-xs text-slate-700 flex items-center gap-1"
                      >
                        <Pause className="w-3.5 h-3.5" />
                        <span>Pause</span>
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400 font-bold uppercase">Paused</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Medication Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200">
            <h2 className="text-2xl font-extrabold text-slate-900 mb-1">Add Medication Schedule</h2>
            <p className="text-xs text-slate-500 mb-6">Enter details exactly as printed on your prescription label.</p>

            <form onSubmit={handleAddMed} className="space-y-4">
              <div>
                <label htmlFor="med-name" className="block text-xs font-bold text-slate-700 uppercase mb-1">Medication Name *</label>
                <input
                  id="med-name"
                  type="text"
                  placeholder="e.g. Amlodipine 5mg"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="med-dose-text" className="block text-xs font-bold text-slate-700 uppercase mb-1">Prescribed Dose *</label>
                  <input
                    id="med-dose-text"
                    type="text"
                    placeholder="e.g. 1 tablet"
                    value={doseText}
                    onChange={e => setDoseText(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="med-form" className="block text-xs font-bold text-slate-700 uppercase mb-1">Form</label>
                  <select
                    id="med-form"
                    value={form}
                    onChange={e => setForm(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm bg-white font-semibold"
                  >
                    <option value="Tablet">Tablet</option>
                    <option value="Capsule">Capsule</option>
                    <option value="Liquid">Liquid / Syrup</option>
                    <option value="Inhaler">Inhaler</option>
                    <option value="Drops">Eye / Ear Drops</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="med-instructions" className="block text-xs font-bold text-slate-700 uppercase mb-1">User Instructions</label>
                <input
                  id="med-instructions"
                  type="text"
                  placeholder="e.g. With water after breakfast"
                  value={instructions}
                  onChange={e => setInstructions(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="med-time-1" className="block text-xs font-bold text-slate-700 uppercase mb-1">First Dose Time (24h)</label>
                  <input
                    id="med-time-1"
                    type="time"
                    value={time1}
                    onChange={e => setTime1(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="med-time-2" className="block text-xs font-bold text-slate-700 uppercase mb-1">Second Dose Time (Optional)</label>
                  <input
                    id="med-time-2"
                    type="time"
                    value={time2}
                    onChange={e => setTime2(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="med-prescriber" className="block text-xs font-bold text-slate-700 uppercase mb-1">Prescribing Doctor</label>
                <input
                  id="med-prescriber"
                  type="text"
                  placeholder="e.g. Dr. Suresh Kulkarni"
                  value={prescriber}
                  onChange={e => setPrescriber(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 rounded-xl text-slate-600 font-bold text-sm hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm shadow-sm"
                >
                  {isSubmitting ? 'Saving...' : 'Save Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
