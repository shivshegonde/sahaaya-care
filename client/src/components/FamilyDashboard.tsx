import React from 'react';
import { DoseInstance, Appointment, CareProfile, Membership, AdherenceData, CareNote } from '../types';
import { AlertTriangle, CheckCircle, Clock, Calendar, Shield, Users, FileText, ArrowRight, Activity, Info, Download } from 'lucide-react';

interface FamilyDashboardProps {
  profile: CareProfile;
  membership: Membership | null;
  doses: DoseInstance[];
  appointments: Appointment[];
  adherence: AdherenceData | null;
  notes: CareNote[];
  onOpenDoseModal: (dose: DoseInstance) => void;
  onExplainAlert: (dose: DoseInstance) => void;
  onOpenAssistant: () => void;
  onNavigateSection: (section: string) => void;
}

export const FamilyDashboard: React.FC<FamilyDashboardProps> = ({
  profile,
  membership,
  doses,
  appointments,
  adherence,
  notes,
  onOpenDoseModal,
  onExplainAlert,
  onOpenAssistant,
  onNavigateSection
}) => {
  // Identify overdue or unconfirmed doses
  const overdueDoses = doses.filter(d => d.status === 'OVERDUE_UNCONFIRMED');
  const dueDoses = doses.filter(d => d.status === 'DUE');
  const takenCount = doses.filter(d => d.status === 'ACKNOWLEDGED_TAKEN').length;

  return (
    <div className="space-y-8 pb-16">
      
      {/* 1. Header & Active Role Context */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-teal-700 uppercase tracking-wider mb-1">
            <Users className="w-4 h-4" />
            <span>Family & Caregiver Portal • Care Circle for {profile.display_name}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            Care Coordination Dashboard
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Role: <strong>{membership?.role || 'Family Member'}</strong> • {membership?.permissions.length || 0} granted scopes
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onNavigateSection('circle')}
            className="px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 font-bold text-xs sm:text-sm text-slate-700 flex items-center gap-2"
          >
            <Shield className="w-4 h-4 text-teal-600" />
            <span>Care Circle & Access</span>
          </button>
          <button
            onClick={() => onNavigateSection('handover')}
            className="px-4 py-2.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 font-bold text-xs sm:text-sm flex items-center gap-2"
          >
            <FileText className="w-4 h-4" />
            <span>Shift Handover Summary</span>
          </button>
        </div>
      </div>

      {/* 2. Urgent Attention Banner: Overdue Unconfirmed Doses */}
      {overdueDoses.length > 0 && (
        <section className="bg-amber-50 border-2 border-amber-300 rounded-3xl p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-xl font-bold text-amber-950">
                  Care Check-in Required: {overdueDoses.length} dose(s) without recorded acknowledgement
                </h2>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-200 text-amber-900">
                  Escalated via Email Policy
                </span>
              </div>
              <p className="text-sm text-amber-900 mt-1 leading-relaxed">
                The {profile.grace_period_minutes}-minute grace period elapsed without an acknowledgement. Sahaaya Care sent an escalation notice to authorized family members.
                <strong className="block mt-0.5 font-medium text-amber-950">
                  Reminder: This indicates no digital confirmation was recorded; it does not assert medicine was omitted.
                </strong>
              </p>

              <div className="mt-4 space-y-2">
                {overdueDoses.map(dose => (
                  <div key={dose.id} className="bg-white/80 p-3.5 rounded-xl border border-amber-200 flex items-center justify-between gap-4">
                    <div>
                      <span className="font-bold text-slate-900">{dose.medication_name} ({dose.dose_text})</span>
                      <span className="text-xs text-slate-500 ml-2">Scheduled: {dose.local_scheduled_at.split('T')[1]?.slice(0, 5)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onExplainAlert(dose)}
                        className="px-3 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-xs flex items-center gap-1"
                      >
                        <Info className="w-3.5 h-3.5" />
                        <span>Explain Alert</span>
                      </button>
                      <button
                        onClick={() => onOpenDoseModal(dose)}
                        className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs"
                      >
                        Update
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 3. 7-Day Adherence Analytics & Today Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Adherence Card */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-teal-600" />
                <h2 className="text-xl font-bold text-slate-900">7-Day Adherence Analytics</h2>
              </div>
              <span className="text-xs text-slate-500">Excludes future doses</span>
            </div>

            {adherence ? (
              <div>
                <div className="flex items-baseline gap-3 mb-4">
                  <span className="text-4xl font-extrabold text-teal-800">
                    {adherence.metrics.adherenceRatePercentage}%
                  </span>
                  <span className="text-sm font-semibold text-slate-600">
                    Recorded Acknowledgement Rate
                  </span>
                </div>

                {/* Metrics Breakdown */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                    <div className="text-xs text-slate-500 font-semibold">Eligible Past Doses</div>
                    <div className="text-xl font-bold text-slate-900 mt-0.5">{adherence.metrics.totalEligiblePastDoses}</div>
                  </div>
                  <div className="bg-emerald-50 p-3 rounded-2xl border border-emerald-200">
                    <div className="text-xs text-emerald-800 font-semibold">Confirmed Taken</div>
                    <div className="text-xl font-bold text-emerald-900 mt-0.5">{adherence.metrics.acknowledgedTaken}</div>
                  </div>
                  <div className="bg-slate-100 p-3 rounded-2xl border border-slate-200">
                    <div className="text-xs text-slate-600 font-semibold">Skipped / Unable</div>
                    <div className="text-xl font-bold text-slate-800 mt-0.5">{adherence.metrics.acknowledgedSkipped + adherence.metrics.unableToTake}</div>
                  </div>
                  <div className="bg-amber-50 p-3 rounded-2xl border border-amber-200">
                    <div className="text-xs text-amber-800 font-semibold">Unconfirmed</div>
                    <div className="text-xl font-bold text-amber-900 mt-0.5">{adherence.metrics.overdueUnconfirmed}</div>
                  </div>
                </div>

                {/* Daily Trend Bars */}
                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Daily Breakdown</div>
                  <div className="grid grid-cols-7 gap-2 text-center">
                    {adherence.dailyBreakdown.map(day => {
                      const dayName = new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' });
                      const pct = day.total > 0 ? Math.round((day.taken / day.total) * 100) : 0;
                      return (
                        <div key={day.date} className="bg-slate-50 p-2 rounded-xl border border-slate-200">
                          <div className="text-[11px] font-bold text-slate-500">{dayName}</div>
                          <div className={`text-sm font-extrabold mt-1 ${pct >= 80 ? 'text-emerald-700' : pct > 0 ? 'text-amber-700' : 'text-slate-400'}`}>
                            {day.total > 0 ? `${pct}%` : '—'}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">{day.taken}/{day.total}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-slate-400 text-center py-8">Calculating adherence analytics...</div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-200 text-xs text-slate-500 flex items-start gap-1.5">
            <Info className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
            <span>{adherence?.methodology.disclaimer}</span>
          </div>
        </div>

        {/* Today's Quick Summary & Actions */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-3xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-teal-400 uppercase tracking-wider">Today at a Glance</span>
              <span className="text-xs text-slate-400">{profile.timezone}</span>
            </div>

            <div className="space-y-4">
              <div className="bg-white/10 p-4 rounded-2xl border border-white/10">
                <div className="text-slate-400 text-xs">Today's Doses Completed</div>
                <div className="text-3xl font-extrabold text-white mt-1">
                  {takenCount} <span className="text-lg font-normal text-slate-400">/ {doses.length}</span>
                </div>
              </div>

              <div className="bg-white/10 p-4 rounded-2xl border border-white/10">
                <div className="text-slate-400 text-xs">Active Prescriptions</div>
                <div className="text-xl font-bold text-white mt-1 flex items-center justify-between">
                  <span>3 Active Routines</span>
                  <button onClick={() => onNavigateSection('medications')} className="text-teal-400 text-xs underline">
                    View
                  </button>
                </div>
              </div>

              <div className="bg-white/10 p-4 rounded-2xl border border-white/10">
                <div className="text-slate-400 text-xs">Upcoming Doctor Visit</div>
                <div className="text-sm font-semibold text-white mt-1">
                  {appointments[0] ? `Dr. ${appointments[0].doctor_name} (${new Date(appointments[0].starts_at_utc).toLocaleDateString()})` : 'No upcoming visits'}
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={onOpenAssistant}
            className="w-full mt-6 bg-teal-500 hover:bg-teal-400 text-slate-900 font-extrabold py-3.5 px-4 rounded-2xl transition-transform active:scale-98 flex items-center justify-center gap-2 text-sm"
          >
            <span>Ask Sahaaya AI Care Assistant</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

      </div>

      {/* 4. Upcoming Doctor Appointments */}
      <section className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-600" />
            <h2 className="text-xl font-bold text-slate-900">Upcoming Medical Appointments</h2>
          </div>
          <button
            onClick={() => onNavigateSection('appointments')}
            className="text-teal-700 hover:text-teal-800 font-bold text-sm underline"
          >
            Schedule Appointment →
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {appointments.slice(0, 2).map(apt => (
            <div key={apt.id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-700 uppercase">{apt.appointment_type}</span>
                  <a
                    href={`/api/v1/appointments/${apt.id}/calendar.ics`}
                    download
                    className="text-xs font-bold text-teal-700 hover:text-teal-800 flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-slate-200"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Add to Calendar</span>
                  </a>
                </div>
                <h3 className="text-lg font-bold text-slate-900 mt-1">Dr. {apt.doctor_name}</h3>
                <p className="text-sm text-slate-600">{apt.specialty || 'General'} • {apt.facility_name}</p>
                <p className="text-xs text-slate-500 mt-2">
                  🗓️ {new Date(apt.starts_at_utc).toLocaleString('en-IN', { dateStyle: 'full', timeStyle: 'short' })}
                </p>
                {apt.notes && <p className="text-xs text-slate-600 mt-1 italic">Notes: {apt.notes}</p>}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 5. Care Updates & Journal */}
      <section className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-teal-600" />
            <h2 className="text-xl font-bold text-slate-900">Recent Care Notes & Observations</h2>
          </div>
          <button
            onClick={() => onNavigateSection('notes')}
            className="text-teal-700 hover:text-teal-800 font-bold text-sm underline"
          >
            Open Care Journal →
          </button>
        </div>

        <div className="space-y-3">
          {notes.slice(0, 3).map(note => (
            <div key={note.id} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span className="font-bold text-slate-700">{note.author_name || 'Care Circle Member'}</span>
                <span>{new Date(note.created_at).toLocaleDateString()}</span>
              </div>
              <p className="text-sm text-slate-800 font-medium">{note.body}</p>
              <span className="inline-block mt-1.5 text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                {note.category.replace(/_/g, ' ')}
              </span>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
};
