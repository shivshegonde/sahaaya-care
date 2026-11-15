import { Router, Request, Response } from 'express';
import { requireAuth } from '../services/auth.js';
import {
  requirePermission,
  PermissionScopes,
  Roles,
  getUserMembership
} from '../services/rbac.js';
import {
  createAppointment,
  getAppointmentById,
  getAppointmentsForProfile,
  updateAppointment,
  cancelAppointment,
  generateIcsCalendar
} from '../services/appointment.js';

export const appointmentRouter = Router();

// ==========================================
// APPOINTMENTS & DOCTOR VISITS
// ==========================================

appointmentRouter.get('/care-profiles/:profileId/appointments', requireAuth, requirePermission(PermissionScopes.APPOINTMENT_VIEW), (req: Request, res: Response) => {
  try {
    const appointments = getAppointmentsForProfile(req.params.profileId);
    res.json({ appointments });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

appointmentRouter.post('/care-profiles/:profileId/appointments', requireAuth, requirePermission(PermissionScopes.APPOINTMENT_MANAGE), (req: Request, res: Response) => {
  try {
    const { doctorName, specialty, facilityName, address, contactNumber, startsAtUtc, appointmentType, notes } = req.body;
    if (!doctorName || !facilityName || !startsAtUtc) {
      return res.status(400).json({ error: 'doctorName, facilityName, and startsAtUtc are required.' });
    }

    const apt = createAppointment({
      careProfileId: req.params.profileId,
      doctorName,
      specialty,
      facilityName,
      address,
      contactNumber,
      startsAtUtc,
      appointmentType,
      notes,
      userId: req.user!.id
    });

    res.status(201).json({ appointment: apt });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

appointmentRouter.patch('/appointments/:appointmentId', requireAuth, (req: Request, res: Response) => {
  try {
    const apt = getAppointmentById(req.params.appointmentId);
    if (!apt) return res.status(404).json({ error: 'Appointment not found' });

    const membership = getUserMembership(apt.care_profile_id, req.user!.id);
    if (!membership || (membership.role !== Roles.ELDER_OWNER && !membership.permissions.includes(PermissionScopes.APPOINTMENT_MANAGE))) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    const updated = updateAppointment(req.params.appointmentId, req.body, req.user!.id);
    res.json({ appointment: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

appointmentRouter.post('/appointments/:appointmentId/cancel', requireAuth, (req: Request, res: Response) => {
  try {
    const apt = getAppointmentById(req.params.appointmentId);
    if (!apt) return res.status(404).json({ error: 'Appointment not found' });

    const membership = getUserMembership(apt.care_profile_id, req.user!.id);
    if (!membership || (membership.role !== Roles.ELDER_OWNER && !membership.permissions.includes(PermissionScopes.APPOINTMENT_MANAGE))) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    const cancelled = cancelAppointment(req.params.appointmentId, req.user!.id, req.body.reason);
    res.json({ appointment: cancelled });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

appointmentRouter.get('/appointments/:appointmentId/calendar.ics', (req: Request, res: Response) => {
  try {
    const icsContent = generateIcsCalendar(req.params.appointmentId);
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="appointment-${req.params.appointmentId}.ics"`);
    res.send(icsContent);
  } catch (err: any) {
    res.status(404).send('Appointment not found');
  }
});
