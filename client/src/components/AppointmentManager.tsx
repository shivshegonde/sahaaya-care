import React, { useState, useEffect } from 'react';
import { CareProfile, Appointment, Membership } from '../types';
import { Calendar, Plus, Download, Clock, MapPin, Phone, ArrowLeft, XCircle } from 'lucide-react';
import { apiRequest } from '../api';

interface AppointmentManagerProps {
  profile: CareProfile;
  membership: Membership | null;
  onBack: () => void;
}

export const AppointmentManager: React.FC<AppointmentManagerProps> = ({ profile, membership, onBack }) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form state
  const [doctorName, setDoctorName] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [facilityName, setFacilityName] = useState('');
  const [address, setAddress] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [appointmentType, setAppointmentType] = useState('Consultation');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canManage = membership?.role === 'ELDER_OWNER' || membership?.permissions.includes('APPOINTMENT_MANAGE');

  const loadAppointments = async () => {
    try {
      const res = await apiRequest(`/care-profiles/${profile.id}/appointments`);
      setAppointments(res.appointments || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAppointments();
  }, [profile.id]);

  const handleAddAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doctorName || !facilityName || !startsAt) return;
    setIsSubmitting(true);
    try {
      await apiRequest(`/care-profiles/${profile.id}/appointments`, {
        method: 'POST',
        body: JSON.stringify({
          doctorName,
          specialty,
          facilityName,
          address,
          contactNumber,
          startsAtUtc: new Date(startsAt).toISOString(),
          appointmentType,
          notes
        })
      });

      setShowAddModal(false);
      setDoctorName('');
      setFacilityName('');
      loadAppointments();
    } catch (err: any) {
      alert(err.message || 'Failed to schedule appointment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = async (aptId: string) => {
    if (!confirm('Cancel this doctor visit? Reminders will be deactivated.')) return;
    try {
      await apiRequest(`/appointments/${aptId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Cancelled by user' })
      });
      loadAppointments();
    } catch (err: any) {
      alert(err.message || 'Failed to cancel appointment.');
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

        {canManage && (
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm px-4 py-2.5 rounded-xl shadow-sm flex items-center gap-2 transition-transform active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Schedule Appointment</span>
          </button>
        )}
      </div>

      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center flex-shrink-0">
          <Calendar className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            Medical Appointments & Clinic Visits
          </h1>
          <p className="text-slate-600 text-sm mt-1">
            Timezone-aware scheduling with automated reminders for {profile.display_name} and family members. Export visits directly to Apple or Google Calendar.
          </p>
        </div>
      </div>

      {/* Appointment Cards */}
      <div className="space-y-4">
        {appointments.map(apt => {
          const isCancelled = apt.status === 'CANCELLED';
          return (
            <div
              key={apt.id}
              className={`p-6 rounded-3xl border transition-all ${
                isCancelled ? 'bg-slate-100 border-slate-200 opacity-60' : 'bg-white border-slate-200 shadow-sm'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider">{apt.appointment_type}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                      isCancelled ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {apt.status}
                    </span>
                  </div>

                  <h3 className="text-xl font-bold text-slate-900 mt-1">Dr. {apt.doctor_name}</h3>
                  <div className="text-sm text-slate-600 font-medium">{apt.specialty || 'General Consultation'} • {apt.facility_name}</div>

                  <div className="mt-3 space-y-1.5 text-xs text-slate-600">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-slate-400" />
                      <span className="font-semibold">{new Date(apt.starts_at_utc).toLocaleString('en-IN', { dateStyle: 'full', timeStyle: 'short' })}</span>
                    </div>
                    {apt.address && (
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-slate-400" />
                        <span>{apt.address}</span>
                      </div>
                    )}
                    {apt.contactNumber && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-slate-400" />
                        <span>{apt.contactNumber}</span>
                      </div>
                    )}
                  </div>

                  {apt.notes && (
                    <div className="mt-3 text-xs bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-slate-700">
                      <strong>Notes:</strong> {apt.notes}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 self-start">
                  {!isCancelled && (
                    <>
                      <a
                        href={`/api/v1/appointments/${apt.id}/calendar.ics`}
                        download
                        className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 font-bold text-xs text-slate-700 flex items-center gap-1.5 transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download .ics</span>
                      </a>
                      {canManage && (
                        <button
                          onClick={() => handleCancel(apt.id)}
                          className="px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 border border-rose-200 font-bold text-xs"
                        >
                          Cancel
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Schedule Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200">
            <h2 className="text-2xl font-extrabold text-slate-900 mb-1">Schedule Doctor Visit</h2>
            <p className="text-xs text-slate-500 mb-6">Automated reminders will be generated for the care circle.</p>

            <form onSubmit={handleAddAppointment} className="space-y-4">
              <div>
                <label htmlFor="apt-doc-name" className="block text-xs font-bold text-slate-700 uppercase mb-1">Doctor Name *</label>
                <input
                  id="apt-doc-name"
                  type="text"
                  placeholder="e.g. Suresh Kulkarni"
                  value={doctorName}
                  onChange={e => setDoctorName(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="apt-specialty" className="block text-xs font-bold text-slate-700 uppercase mb-1">Specialty</label>
                  <input
                    id="apt-specialty"
                    type="text"
                    placeholder="e.g. Cardiology"
                    value={specialty}
                    onChange={e => setSpecialty(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="apt-type" className="block text-xs font-bold text-slate-700 uppercase mb-1">Type</label>
                  <select
                    id="apt-type"
                    value={appointmentType}
                    onChange={e => setAppointmentType(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white font-semibold"
                  >
                    <option value="Consultation">Consultation</option>
                    <option value="Follow-up">Follow-up</option>
                    <option value="Lab Test / Diagnostics">Lab Test</option>
                    <option value="Dental">Dental</option>
                    <option value="Eye Checkup">Eye Checkup</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="apt-facility" className="block text-xs font-bold text-slate-700 uppercase mb-1">Clinic / Hospital Name *</label>
                <input
                  id="apt-facility"
                  type="text"
                  placeholder="e.g. Apollo Specialty Clinic"
                  value={facilityName}
                  onChange={e => setFacilityName(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>

              <div>
                <label htmlFor="apt-datetime" className="block text-xs font-bold text-slate-700 uppercase mb-1">Date & Time *</label>
                <input
                  id="apt-datetime"
                  type="datetime-local"
                  value={startsAt}
                  onChange={e => setStartsAt(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>

              <div>
                <label htmlFor="apt-phone" className="block text-xs font-bold text-slate-700 uppercase mb-1">Contact Phone</label>
                <input
                  id="apt-phone"
                  type="tel"
                  placeholder="e.g. +91 98450 12345"
                  value={contactNumber}
                  onChange={e => setContactNumber(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>

              <div>
                <label htmlFor="apt-notes" className="block text-xs font-bold text-slate-700 uppercase mb-1">Notes / Questions to Ask Doctor</label>
                <input
                  id="apt-notes"
                  type="text"
                  placeholder="e.g. Bring fasting blood sugar and lipid report"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
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
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-sm"
                >
                  {isSubmitting ? 'Saving...' : 'Confirm Appointment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
