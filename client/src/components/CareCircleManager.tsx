import React, { useState, useEffect } from 'react';
import { CareProfile, Membership } from '../types';
import { Shield, UserPlus, Trash2, Key, Check, Copy, AlertCircle, ArrowLeft } from 'lucide-react';
import { apiRequest } from '../api';

interface CareCircleManagerProps {
  profile: CareProfile;
  currentMembership: Membership | null;
  onBack: () => void;
}

export const CareCircleManager: React.FC<CareCircleManagerProps> = ({ profile, currentMembership, onBack }) => {
  const [members, setMembers] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Invite form state
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'FAMILY_ADMIN' | 'FAMILY_MEMBER' | 'CARETAKER' | 'CARE_COORDINATOR'>('FAMILY_MEMBER');
  const [newInviteCode, setNewInviteCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOwner = currentMembership?.role === 'ELDER_OWNER';
  const canInvite = isOwner || currentMembership?.permissions.includes('MEMBER_INVITE');
  const canRevoke = isOwner || currentMembership?.permissions.includes('MEMBER_REVOKE');

  const loadData = async () => {
    try {
      const res = await apiRequest(`/care-profiles/${profile.id}/members`);
      setMembers(res.members || []);
      setInvitations(res.pendingInvitations || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [profile.id]);

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setError(null);
    try {
      const res = await apiRequest(`/care-profiles/${profile.id}/invitations`, {
        method: 'POST',
        body: JSON.stringify({ email, role })
      });
      setNewInviteCode(res.rawCode);
      setEmail('');
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to create invitation.');
    }
  };

  const handleRevoke = async (memberUserId: string) => {
    if (!confirm('Are you sure you want to revoke this person’s access to the care profile?')) return;
    try {
      await apiRequest(`/care-profiles/${profile.id}/members/${memberUserId}`, {
        method: 'DELETE'
      });
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to revoke access.');
    }
  };

  const copyCode = () => {
    if (newInviteCode) {
      navigator.clipboard.writeText(newInviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-8 pb-16 max-w-4xl mx-auto">
      
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="text-slate-600 hover:text-slate-900 font-bold text-sm flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </button>
        <div className="text-xs font-bold text-teal-800 bg-teal-50 px-3 py-1 rounded-full border border-teal-200">
          Consent-First Architecture
        </div>
      </div>

      {/* Title & Philosophy Banner */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-teal-100 text-teal-800 flex items-center justify-center flex-shrink-0">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              My Care Circle & Permissions
            </h1>
            <p className="text-slate-600 text-sm sm:text-base mt-1 leading-relaxed">
              In Sahaaya Care, <strong>the elderly person stays in control</strong>. Access is granted through single-use, cryptographically hashed passcodes with explicit permissions, and can be revoked at any time.
            </p>
          </div>
        </div>
      </div>

      {/* Invite Family Member or Caretaker Form */}
      {canInvite && (
        <section className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 mb-2 flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-teal-600" />
            <span>Invite a Trusted Person</span>
          </h2>
          <p className="text-slate-500 text-sm mb-4">
            Generate a secure, single-use invitation passcode for a family member, doctor, or caretaker.
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-semibold">
              {error}
            </div>
          )}

          {newInviteCode ? (
            <div className="p-6 rounded-2xl bg-teal-50 border-2 border-teal-500 mb-6 animate-in fade-in">
              <div className="text-xs font-bold uppercase tracking-wider text-teal-900 mb-1">
                Single-Use Passcode Generated
              </div>
              <p className="text-sm text-teal-800 mb-3">
                Share this code with your invitee. They will enter this code after logging in to redeem access. (Only a secure SHA-256 hash is saved on our servers).
              </p>
              <div className="flex items-center gap-3">
                <span className="font-mono text-2xl font-extrabold bg-white px-4 py-2 rounded-xl border border-teal-300 text-teal-950 tracking-widest">
                  {newInviteCode}
                </span>
                <button
                  onClick={copyCode}
                  className="bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm px-4 py-2.5 rounded-xl flex items-center gap-2 transition-colors"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? 'Copied!' : 'Copy Code'}</span>
                </button>
              </div>
              <button
                onClick={() => setNewInviteCode(null)}
                className="mt-4 text-xs font-bold text-teal-700 underline"
              >
                + Generate another invite
              </button>
            </div>
          ) : (
            <form onSubmit={handleCreateInvite} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="invite-email" className="block text-xs font-bold text-slate-700 uppercase mb-1">Email Address</label>
                <input
                  id="invite-email"
                  type="email"
                  placeholder="e.g. daughter@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                />
              </div>

              <div>
                <label htmlFor="invite-role" className="block text-xs font-bold text-slate-700 uppercase mb-1">Role & Permission Preset</label>
                <select
                  id="invite-role"
                  value={role}
                  onChange={e => setRole(e.target.value as any)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm bg-white font-semibold"
                >
                  <option value="FAMILY_MEMBER">Family Member (View & Acknowledge)</option>
                  <option value="FAMILY_ADMIN">Family Admin (Full Manage Access)</option>
                  <option value="CARETAKER">Caretaker (Shift Notes & Doses)</option>
                  <option value="CARE_COORDINATOR">Care Coordinator (Doctor / Clinician)</option>
                </select>
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-2.5 px-4 rounded-xl text-sm transition-colors shadow-sm"
                >
                  Create Passcode
                </button>
              </div>
            </form>
          )}
        </section>
      )}

      {/* Active Care Circle Members Table */}
      <section className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900 mb-4">Active Circle Members ({members.length})</h2>

        <div className="divide-y divide-slate-200">
          {members.map(member => {
            const isSelf = member.user_id === currentMembership?.user_id;
            const isElderOwner = member.role === 'ELDER_OWNER';

            return (
              <div key={member.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-slate-900 text-base">{member.display_name}</span>
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                      {member.role.replace(/_/g, ' ')}
                    </span>
                    {isSelf && (
                      <span className="text-xs font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full">
                        You
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">{member.email} • Joined {new Date(member.accepted_at).toLocaleDateString()}</div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {member.permissions.map((p: string) => (
                      <span key={p} className="text-[10px] font-mono bg-slate-50 text-slate-600 border border-slate-200 px-1.5 py-0.5 rounded">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>

                {canRevoke && !isElderOwner && (
                  <button
                    onClick={() => handleRevoke(member.user_id)}
                    className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 font-bold text-xs px-3 py-2 rounded-xl border border-rose-200 flex items-center gap-1.5 transition-colors self-start sm:self-auto"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Revoke Access</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Pending Invitations */}
      {invitations.length > 0 && (
        <section className="bg-slate-100 p-6 rounded-3xl border border-slate-200">
          <h2 className="text-lg font-bold text-slate-900 mb-3">Pending Invitations ({invitations.length})</h2>
          <div className="space-y-2">
            {invitations.map(inv => (
              <div key={inv.id} className="bg-white p-3.5 rounded-xl border border-slate-200 flex items-center justify-between text-sm">
                <div>
                  <span className="font-bold text-slate-900">{inv.email}</span>
                  <span className="text-xs text-slate-500 ml-2">Role: {inv.role}</span>
                  <div className="text-xs text-amber-700 mt-0.5">Expires: {new Date(inv.expires_at).toLocaleDateString()}</div>
                </div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Awaiting Redemption</span>
              </div>
            ))}
          </div>
        </section>
      )}

    </div>
  );
};
