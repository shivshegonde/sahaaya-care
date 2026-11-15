import React, { useState, useEffect } from 'react';
import { User, CareProfile, Membership, DoseInstance, Appointment, AdherenceData, CareNote } from './types';
import { apiRequest, getAuthToken, setAuthToken } from './api';
import { Navbar } from './components/Navbar';
import { ElderDashboard } from './components/ElderDashboard';
import { FamilyDashboard } from './components/FamilyDashboard';
import { DoseModal } from './components/DoseModal';
import { ExplainAlertModal } from './components/ExplainAlertModal';
import { AiAssistantModal } from './components/AiAssistantModal';
import { CareCircleManager } from './components/CareCircleManager';
import { MedicationManager } from './components/MedicationManager';
import { AppointmentManager } from './components/AppointmentManager';
import { CareJournal } from './components/CareJournal';
import { NotificationInspector } from './components/NotificationInspector';
import { DemoSimulationBar } from './components/DemoSimulationBar';
import { AuthModal } from './components/AuthModal';
import { Loader2 } from 'lucide-react';

export const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [activeProfile, setActiveProfile] = useState<CareProfile | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [viewMode, setViewMode] = useState<'elder' | 'family'>('elder');
  const [currentSection, setCurrentSection] = useState<'dashboard' | 'medications' | 'appointments' | 'circle' | 'notes' | 'handover'>('dashboard');
  const [isHighContrast, setIsHighContrast] = useState(() => {
    try {
      return localStorage.getItem('sahaaya_high_contrast') === 'true';
    } catch (_) {
      return false;
    }
  });

  // Sync high-contrast mode class to root HTML & body
  useEffect(() => {
    if (isHighContrast) {
      document.documentElement.classList.add('high-contrast');
      document.body.classList.add('high-contrast');
    } else {
      document.documentElement.classList.remove('high-contrast');
      document.body.classList.remove('high-contrast');
    }
    try {
      localStorage.setItem('sahaaya_high_contrast', String(isHighContrast));
    } catch (_) {}
  }, [isHighContrast]);

  // Care data state
  const [doses, setDoses] = useState<DoseInstance[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [adherence, setAdherence] = useState<AdherenceData | null>(null);
  const [notes, setNotes] = useState<CareNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Active Modals
  const [activeDoseForModal, setActiveDoseForModal] = useState<DoseInstance | null>(null);
  const [activeAlertForExplain, setActiveAlertForExplain] = useState<DoseInstance | null>(null);
  const [showAssistantModal, setShowAssistantModal] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);

  // Initial Auth & Data Load
  useEffect(() => {
    const initAuth = async () => {
      const token = getAuthToken();
      if (!token) {
        setIsLoading(false);
        return;
      }
      try {
        const meRes = await apiRequest('/me');
        setUser(meRes.user);
        await loadCareProfile(meRes.user);
      } catch (e) {
        setAuthToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };
    initAuth();
  }, []);

  // Keyboard Accessibility: Close active modals on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveDoseForModal(null);
        setActiveAlertForExplain(null);
        setShowAssistantModal(false);
        setShowNotificationsModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const loadCareProfile = async (currentUser: User) => {
    try {
      const profilesRes = await apiRequest('/care-profiles');
      if (profilesRes.profiles && profilesRes.profiles.length > 0) {
        const primary = profilesRes.profiles[0];
        setActiveProfile(primary);

        // Set initial view mode based on role
        if (primary.role === 'ELDER_OWNER') {
          setViewMode('elder');
        } else {
          setViewMode('family');
        }

        const profileDetails = await apiRequest(`/care-profiles/${primary.id}`);
        setMembership(profileDetails.membership);
        await refreshCareData(primary.id);
      }
    } catch (err: any) {
      console.error('Error loading care profiles:', err);
    }
  };

  const refreshCareData = async (profileId?: string) => {
    const id = profileId || activeProfile?.id;
    if (!id) return;

    try {
      const [dosesRes, aptsRes, adhRes, notesRes] = await Promise.all([
        apiRequest(`/care-profiles/${id}/doses/today`),
        apiRequest(`/care-profiles/${id}/appointments`),
        apiRequest(`/care-profiles/${id}/adherence?days=7`),
        apiRequest(`/care-profiles/${id}/notes`)
      ]);
      setDoses(dosesRes.doses || []);
      setAppointments(aptsRes.appointments || []);
      setAdherence(adhRes || null);
      setNotes(notesRes.notes || []);
    } catch (err: any) {
      console.error('Error refreshing care data:', err);
    }
  };

  const toggleHighContrast = () => {
    setIsHighContrast(prev => !prev);
  };

  const handleLogout = () => {
    setAuthToken(null);
    setUser(null);
    setActiveProfile(null);
    setMembership(null);
  };

  const handleQuickLogin = async (email: string) => {
    setIsLoading(true);
    try {
      const res = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password: 'DemoPass123!' })
      });
      setAuthToken(res.token);
      setUser(res.user);
      await loadCareProfile(res.user);
      setCurrentSection('dashboard');
    } catch (err: any) {
      console.error('Quick login failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOneTapHelp = async () => {
    if (!activeProfile || !user) return;
    try {
      await apiRequest(`/care-profiles/${activeProfile.id}/notes`, {
        method: 'POST',
        body: JSON.stringify({
          category: 'FOLLOW_UP',
          body: `Check-in Requested: ${activeProfile.display_name} tapped "I Need Help". Please check in with them as soon as possible.`
        })
      });
      alert('Assistance Request Sent: A check-in notification has been posted to your care circle journal. Authorized family contacts will be informed.');
      refreshCareData();
    } catch (e: any) {
      alert('Could not send help request: ' + e.message);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-800">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
          <span className="text-sm font-semibold text-slate-600">Loading Sahaaya Care Platform...</span>
        </div>
      </div>
    );
  }

  // If user not signed in, show Auth / Demo Modal
  if (!user || !activeProfile) {
    return (
      <AuthModal
        onSuccess={async (newUser) => {
          setUser(newUser);
          setIsLoading(true);
          await loadCareProfile(newUser);
          setIsLoading(false);
        }}
      />
    );
  }

  return (
    <div className={`min-h-screen flex flex-col ${isHighContrast ? 'high-contrast' : ''}`}>
      
      {/* WCAG 2.2 AA Global Skip Link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-teal-900 focus:text-white focus:rounded-xl focus:shadow-xl focus:outline-none focus:ring-4 focus:ring-teal-400 font-bold"
      >
        Skip to main content
      </a>

      {/* Top Navbar */}
      <Navbar
        user={user}
        activeProfile={activeProfile}
        membership={membership}
        viewMode={viewMode}
        setViewMode={setViewMode}
        isHighContrast={isHighContrast}
        toggleHighContrast={toggleHighContrast}
        onOpenAssistant={() => setShowAssistantModal(true)}
        onOpenNotifications={() => setShowNotificationsModal(true)}
        onOpenHelp={handleOneTapHelp}
        onLogout={handleLogout}
      />

      {/* Main Container */}
      <main id="main-content" className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-36 sm:pb-24">
        {currentSection === 'circle' ? (
          <CareCircleManager
            profile={activeProfile}
            currentMembership={membership}
            onBack={() => setCurrentSection('dashboard')}
          />
        ) : currentSection === 'medications' ? (
          <MedicationManager
            profile={activeProfile}
            membership={membership}
            onBack={() => setCurrentSection('dashboard')}
          />
        ) : currentSection === 'appointments' ? (
          <AppointmentManager
            profile={activeProfile}
            membership={membership}
            onBack={() => setCurrentSection('dashboard')}
          />
        ) : currentSection === 'notes' || currentSection === 'handover' ? (
          <CareJournal
            profile={activeProfile}
            membership={membership}
            initialTab={currentSection === 'handover' ? 'handover' : 'journal'}
            onBack={() => setCurrentSection('dashboard')}
          />
        ) : viewMode === 'elder' ? (
          <ElderDashboard
            profile={activeProfile}
            membership={membership}
            doses={doses}
            appointments={appointments}
            onOpenDoseModal={dose => setActiveDoseForModal(dose)}
            onOpenAssistant={() => setShowAssistantModal(true)}
            onOpenHelp={handleOneTapHelp}
            onNavigateSection={sec => setCurrentSection(sec as any)}
          />
        ) : (
          <FamilyDashboard
            profile={activeProfile}
            membership={membership}
            doses={doses}
            appointments={appointments}
            adherence={adherence}
            notes={notes}
            onOpenDoseModal={dose => setActiveDoseForModal(dose)}
            onExplainAlert={dose => setActiveAlertForExplain(dose)}
            onOpenAssistant={() => setShowAssistantModal(true)}
            onNavigateSection={sec => setCurrentSection(sec as any)}
          />
        )}
      </main>

      {/* Active Modals */}
      {activeDoseForModal && (
        <DoseModal
          dose={activeDoseForModal}
          onClose={() => setActiveDoseForModal(null)}
          onSuccess={() => refreshCareData()}
        />
      )}

      {activeAlertForExplain && (
        <ExplainAlertModal
          dose={activeAlertForExplain}
          profile={activeProfile}
          onClose={() => setActiveAlertForExplain(null)}
        />
      )}

      {showAssistantModal && (
        <AiAssistantModal
          profile={activeProfile}
          onClose={() => setShowAssistantModal(false)}
        />
      )}

      {showNotificationsModal && (
        <NotificationInspector
          profile={activeProfile}
          onClose={() => setShowNotificationsModal(false)}
        />
      )}

      {/* Persistent Judge Demo Simulation Bar */}
      <DemoSimulationBar
        currentProfileId={activeProfile?.id}
        onRefreshData={() => refreshCareData()}
        onQuickLogin={handleQuickLogin}
        onOpenNotifications={() => setShowNotificationsModal(true)}
      />

    </div>
  );
};
