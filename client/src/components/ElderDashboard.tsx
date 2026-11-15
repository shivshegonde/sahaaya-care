import React, { useState } from 'react';
import { DoseInstance, Appointment, CareProfile, Membership } from '../types';
import { CheckCircle2, XCircle, Clock, Calendar, AlertTriangle, ShieldCheck, HelpCircle, Pill, Sparkles, MapPin, Phone, Volume2, VolumeX } from 'lucide-react';

interface ElderDashboardProps {
  profile: CareProfile;
  membership: Membership | null;
  doses: DoseInstance[];
  appointments: Appointment[];
  onOpenDoseModal: (dose: DoseInstance) => void;
  onOpenAssistant: () => void;
  onOpenHelp: () => void;
  onNavigateSection: (section: string) => void;
}

export const ElderDashboard: React.FC<ElderDashboardProps> = ({
  profile,
  membership,
  doses,
  appointments,
  onOpenDoseModal,
  onOpenAssistant,
  onOpenHelp,
  onNavigateSection
}) => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [fontSizeLevel, setFontSizeLevel] = useState<'normal' | 'large' | 'xlarge'>(() => {
    try {
      return (localStorage.getItem('sahaaya_font_size') as any) || 'normal';
    } catch (_) {
      return 'normal';
    }
  });

  // Apply root font-size scaling so all rem-based typography scales dynamically
  React.useEffect(() => {
    const scaleMap: Record<'normal' | 'large' | 'xlarge', string> = {
      normal: '100%',
      large: '120%',
      xlarge: '140%'
    };
    const target = scaleMap[fontSizeLevel] || '100%';
    document.documentElement.style.fontSize = target;
    try {
      localStorage.setItem('sahaaya_font_size', fontSizeLevel);
    } catch (_) {}

    return () => {
      document.documentElement.style.fontSize = '100%';
    };
  }, [fontSizeLevel]);

  // Load available system & browser voices
  React.useEffect(() => {
    if (!('speechSynthesis' in window)) return;
    const updateVoices = () => {
      const avail = window.speechSynthesis.getVoices();
      if (avail && avail.length > 0) {
        setVoices(avail);
      }
    };
    updateVoices();
    window.speechSynthesis.onvoiceschanged = updateVoices;
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  // Determine greeting based on local time
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  // Find next pending or due dose
  const nextDose = doses.find(d => d.status === 'DUE' || d.status === 'UPCOMING' || d.status === 'OVERDUE_UNCONFIRMED');
  const nextAppointment = appointments.find(a => a.status === 'SCHEDULED');

  const takenCount = doses.filter(d => d.status === 'ACKNOWLEDGED_TAKEN').length;
  const totalCount = doses.length;

  // Senior Accessibility: Web Speech API voice reader with Indian Female Voice
  const handleToggleSpeech = () => {
    if (!('speechSynthesis' in window)) {
      alert('Voice read-aloud is not supported on this browser.');
      return;
    }
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    const text = `Namaste ${profile.display_name}. ${greeting}. Here is your Sahaaya care update. Today you have ${totalCount} scheduled medicines. ${takenCount} are confirmed taken. ${
      nextDose
        ? `Your next medicine is ${nextDose.medication_name} ${nextDose.dose_text}, scheduled for ${new Date(nextDose.scheduled_at_utc).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Prescribed instruction: ${nextDose.instructions_verbatim || 'Please take it with water as directed'}.`
        : 'You have no pending medicines remaining for today.'
    } ${nextAppointment ? `You also have an appointment with ${nextAppointment.doctor_name} at ${new Date(nextAppointment.scheduled_at_utc).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.` : ''} Take care and stay well.`;

    const utterance = new SpeechSynthesisUtterance(text);

    // Prioritize natural Indian English female voices (e.g. Neerja, Heera, Swara, Google en-IN)
    const list = voices.length > 0 ? voices : window.speechSynthesis.getVoices();
    const indianFemale = list.find(v =>
      (v.lang === 'en-IN' || v.lang === 'en_IN' || v.lang.startsWith('en-IN')) &&
      (v.name.toLowerCase().includes('neerja') ||
       v.name.toLowerCase().includes('heera') ||
       v.name.toLowerCase().includes('swara') ||
       v.name.toLowerCase().includes('female') ||
       v.name.toLowerCase().includes('natural') ||
       v.name.toLowerCase().includes('google'))
    ) || list.find(v => v.lang === 'en-IN' || v.lang === 'en_IN')
      || list.find(v => v.lang.startsWith('en') && (v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('zira') || v.name.toLowerCase().includes('samantha')));

    if (indianFemale) {
      utterance.voice = indianFemale;
      utterance.lang = indianFemale.lang || 'en-IN';
    } else {
      utterance.lang = 'en-IN';
    }

    utterance.pitch = 1.05; // Gentle, warm tone
    utterance.rate = 0.86; // Soothing, calm cadence for older adults
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div id="elder-dashboard-content" className="space-y-8 pb-16 transition-all duration-150">
        
        {/* 1. Senior Greeting & Summary Banner */}
        <section className="bg-gradient-to-br from-teal-800 to-teal-950 text-white rounded-3xl p-6 sm:p-8 shadow-md border border-teal-700/50">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-3">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-700/60 text-teal-200 text-sm font-semibold w-fit">
              <span>🌿</span> Sahaaya Senior View
            </span>

            {/* Senior Font Scaler (WCAG 2.2 AA Large Print Control) */}
            <div className="flex items-center gap-1.5 bg-teal-900/80 p-1.5 rounded-2xl border border-teal-600/50 w-fit" role="group" aria-label="Adjust font size">
              <span className="text-xs text-teal-200 px-2 font-medium">Text Size:</span>
              <button
                type="button"
                onClick={() => setFontSizeLevel('normal')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  fontSizeLevel === 'normal'
                    ? 'bg-amber-400 text-teal-950 shadow-md ring-2 ring-amber-300 font-extrabold scale-105'
                    : 'text-teal-200 hover:text-white hover:bg-teal-800/60'
                }`}
                aria-label="Normal 100% text"
                aria-pressed={fontSizeLevel === 'normal'}
              >
                A
              </button>
              <button
                type="button"
                onClick={() => setFontSizeLevel('large')}
                className={`px-3.5 py-1.5 rounded-xl text-sm font-bold transition-all ${
                  fontSizeLevel === 'large'
                    ? 'bg-amber-400 text-teal-950 shadow-md ring-2 ring-amber-300 font-extrabold scale-105'
                    : 'text-teal-200 hover:text-white hover:bg-teal-800/60'
                }`}
                aria-label="Large 120% text"
                aria-pressed={fontSizeLevel === 'large'}
              >
                A+
              </button>
              <button
                type="button"
                onClick={() => setFontSizeLevel('xlarge')}
                className={`px-3.5 py-1.5 rounded-xl text-base font-extrabold transition-all ${
                  fontSizeLevel === 'xlarge'
                    ? 'bg-amber-400 text-teal-950 shadow-md ring-2 ring-amber-300 font-extrabold scale-105'
                    : 'text-teal-200 hover:text-white hover:bg-teal-800/60'
                }`}
                aria-label="Extra large 140% text"
                aria-pressed={fontSizeLevel === 'xlarge'}
              >
                A++
              </button>
            </div>
          </div>

          <div className="max-w-3xl">
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              {greeting}, {profile.display_name}!
            </h1>
            <p className="mt-2 text-lg sm:text-xl text-teal-100 font-medium leading-relaxed">
              Today you have <strong className="text-white underline decoration-teal-400">{totalCount} scheduled doses</strong> ({takenCount} confirmed taken) and {nextAppointment ? '1 medical visit' : 'no clinic visits'}.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={handleToggleSpeech}
                aria-label="Read today's schedule aloud"
                className="bg-amber-400 hover:bg-amber-300 text-teal-950 font-bold px-5 py-3 rounded-2xl shadow-sm flex items-center gap-2 text-base transition-transform active:scale-95"
              >
                {isSpeaking ? (
                  <>
                    <VolumeX className="w-5 h-5 text-teal-950 animate-pulse" />
                    <span>Stop Voice</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-5 h-5 text-teal-950" />
                    <span>Read Plan Aloud</span>
                  </>
                )}
              </button>
              <button
                onClick={onOpenAssistant}
                className="bg-white hover:bg-teal-50 text-teal-900 font-bold px-5 py-3 rounded-2xl shadow-sm flex items-center gap-2 text-base transition-transform active:scale-95"
              >
                <Sparkles className="w-5 h-5 text-teal-600" />
                <span>Ask Sahaaya</span>
              </button>
              <button
                onClick={onOpenHelp}
                className="bg-teal-700/80 hover:bg-teal-700 text-white font-semibold px-4 py-3 rounded-2xl flex items-center gap-2 text-base transition-colors"
              >
                <HelpCircle className="w-5 h-5 text-teal-200" />
                <span>I Need Assistance</span>
              </button>
            </div>
          </div>
        </section>

      {/* 2. Most Prominent Next Dose Action Card */}
      {nextDose ? (
        <section aria-live="polite" className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border-2 border-teal-500/80 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-teal-100 flex items-center justify-center text-teal-800 flex-shrink-0">
                <Pill className="w-7 h-7 text-teal-700" />
              </div>
              <div>
                <div className="text-xs sm:text-sm font-bold text-teal-700 uppercase tracking-wider">Next Medication</div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 leading-tight">{nextDose.medication_name}</h2>
              </div>
            </div>
            <div className="bg-teal-600 text-white font-bold text-xs uppercase tracking-wider px-4 py-2 rounded-full shadow-sm">
              {nextDose.status === 'DUE' ? '🔔 Due Now' : nextDose.status === 'OVERDUE_UNCONFIRMED' ? '⚠️ Check-in Needed' : '⏰ Upcoming Next'}
            </div>
          </div>

          <div className="text-lg font-medium text-slate-600 mb-4">{nextDose.dose_text} ({nextDose.form})</div>

          {nextDose.instructions && (
            <div className="bg-teal-50/70 border border-teal-200/80 rounded-2xl p-4 mb-6">
              <div className="text-xs font-bold text-teal-900 uppercase">Your Instructions:</div>
              <p className="text-base sm:text-lg font-semibold text-teal-950 mt-0.5">"{nextDose.instructions}"</p>
            </div>
          )}

          <div className="text-base text-slate-600 mb-6 flex items-center gap-2">
            <Clock className="w-5 h-5 text-teal-600" />
            <span>Scheduled for <strong>{nextDose.local_scheduled_at.split('T')[1]?.slice(0, 5) || 'Today'}</strong></span>
          </div>

          {/* Large Senior-Friendly Touch Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              onClick={() => onOpenDoseModal(nextDose)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-lg py-4 px-6 rounded-2xl shadow-sm flex items-center justify-center gap-3 transition-transform active:scale-98"
            >
              <CheckCircle2 className="w-6 h-6" />
              <span>Mark Taken</span>
            </button>
            <button
              onClick={() => onOpenDoseModal(nextDose)}
              className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-base py-4 px-6 rounded-2xl border border-slate-300 flex items-center justify-center gap-2 transition-colors"
            >
              <XCircle className="w-5 h-5 text-slate-500" />
              <span>Skip / Reason</span>
            </button>
            <button
              onClick={onOpenHelp}
              className="bg-rose-50 hover:bg-rose-100 text-rose-800 font-bold text-base py-4 px-6 rounded-2xl border border-rose-200 flex items-center justify-center gap-2 transition-colors"
            >
              <HelpCircle className="w-5 h-5 text-rose-600" />
              <span>Need Help</span>
            </button>
          </div>
        </section>
      ) : (
        <section className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-3 text-2xl">
            ✨
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900">All caught up for today!</h2>
          <p className="text-slate-600 text-lg mt-1">Great job! All scheduled medication doses for today have been acknowledged.</p>
        </section>
      )}

      {/* 3. Today's Medication Timeline */}
      <section className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Today's Medication Timeline</h2>
            <p className="text-slate-500 text-sm mt-0.5">Clear confirmation and status for each scheduled dose</p>
          </div>
          <button
            onClick={() => onNavigateSection('medications')}
            className="text-teal-700 hover:text-teal-800 font-bold text-sm underline"
          >
            Manage Prescriptions →
          </button>
        </div>

        <div className="space-y-4">
          {doses.map((dose) => {
            const timeStr = dose.local_scheduled_at.split('T')[1]?.slice(0, 5) || '09:00';
            const isTaken = dose.status === 'ACKNOWLEDGED_TAKEN';
            const isSkipped = dose.status === 'ACKNOWLEDGED_SKIPPED' || dose.status === 'UNABLE_TO_TAKE';
            const isOverdue = dose.status === 'OVERDUE_UNCONFIRMED';
            const isDue = dose.status === 'DUE';

            return (
              <div
                key={dose.id}
                className={`p-5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  isTaken
                    ? 'bg-emerald-50/50 border-emerald-200 text-slate-900'
                    : isOverdue
                    ? 'bg-amber-50/70 border-amber-300 text-slate-900'
                    : isDue
                    ? 'bg-teal-50 border-teal-300 text-slate-900'
                    : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                    isTaken ? 'bg-emerald-600 text-white' : isOverdue ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-800'
                  }`}>
                    {timeStr}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-bold text-slate-900">{dose.medication_name}</h3>
                      <span className="text-sm font-semibold text-slate-500">({dose.dose_text})</span>
                    </div>
                    {dose.instructions && (
                      <p className="text-sm text-slate-600 mt-0.5">Instruction: {dose.instructions}</p>
                    )}
                    {dose.acknowledged_by_name && (
                      <p className="text-xs text-emerald-800 font-medium mt-1">
                        ✓ Confirmed by {dose.acknowledged_by_name} at {dose.acknowledged_at?.split('T')[1]?.slice(0, 5)}
                      </p>
                    )}
                    {isOverdue && (
                      <p className="text-xs text-amber-800 font-bold mt-1">
                        ⚠️ No acknowledgement was recorded within the grace period. Family check-in alert generated.
                      </p>
                    )}
                  </div>
                </div>

                {/* Status Badge & Action */}
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                    isTaken ? 'bg-emerald-100 text-emerald-800' :
                    isSkipped ? 'bg-slate-200 text-slate-800' :
                    isOverdue ? 'bg-amber-100 text-amber-900 border border-amber-300' :
                    isDue ? 'bg-teal-100 text-teal-800 animate-pulse' :
                    'bg-slate-200 text-slate-700'
                  }`}>
                    {dose.status.replace(/_/g, ' ')}
                  </span>

                  <button
                    onClick={() => onOpenDoseModal(dose)}
                    className="px-4 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 font-bold text-sm text-slate-800 shadow-sm"
                  >
                    {isTaken ? 'Edit / Undo' : 'Update Status'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 4. Next Appointment Card */}
      {nextAppointment && (
        <section className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center flex-shrink-0">
                <Calendar className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider">Upcoming Medical Visit</span>
                <h3 className="text-2xl font-extrabold text-slate-900 mt-0.5">Dr. {nextAppointment.doctor_name}</h3>
                <div className="text-base text-slate-600 font-medium">{nextAppointment.specialty || 'General Consultation'} • {nextAppointment.appointment_type}</div>
                
                <div className="mt-3 space-y-1.5 text-sm text-slate-600">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span>{new Date(nextAppointment.starts_at_utc).toLocaleString('en-IN', { dateStyle: 'full', timeStyle: 'short' })}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-slate-400" />
                    <span>{nextAppointment.facility_name}{nextAppointment.address ? `, ${nextAppointment.address}` : ''}</span>
                  </div>
                  {nextAppointment.contactNumber && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-slate-400" />
                      <span>{nextAppointment.contactNumber}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={() => onNavigateSection('appointments')}
              className="text-teal-700 hover:text-teal-800 font-bold text-sm underline"
            >
              View Calendar →
            </button>
          </div>
        </section>
      )}

      {/* 5. My Care Circle & Access Consent Summary */}
      <section className="bg-slate-100 rounded-3xl p-6 sm:p-8 border border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-teal-700" />
            <h3 className="text-xl font-bold text-slate-900">Who Can See My Care Information?</h3>
          </div>
          <button
            onClick={() => onNavigateSection('circle')}
            className="text-teal-700 hover:text-teal-800 font-bold text-sm underline"
          >
            Manage Circle Permissions →
          </button>
        </div>
        <p className="text-slate-600 text-sm leading-relaxed mb-4">
          In Sahaaya Care, <strong>you remain in control</strong>. Only people you explicitly invite can view your medication schedule or receive check-in alerts. You can revoke access at any time.
        </p>

        <div className="flex flex-wrap gap-3">
          <div className="bg-white px-4 py-2.5 rounded-2xl border border-slate-200 flex items-center gap-2 text-sm font-semibold text-slate-800">
            <span>👩</span> Meera Rao (Family Admin)
          </div>
          <div className="bg-white px-4 py-2.5 rounded-2xl border border-slate-200 flex items-center gap-2 text-sm font-semibold text-slate-800">
            <span>👨</span> Ravi Patil (Home Care Assistant)
          </div>
        </div>
      </section>

    </div>
  );
};
