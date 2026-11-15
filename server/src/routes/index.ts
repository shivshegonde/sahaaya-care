import { Router } from 'express';
import { authRouter } from './auth.routes.js';
import { profileRouter } from './profile.routes.js';
import { medicationRouter } from './medication.routes.js';
import { doseRouter } from './dose.routes.js';
import { appointmentRouter } from './appointment.routes.js';
import { notesRouter } from './notes.routes.js';
import { aiRouter } from './ai.routes.js';
import { demoRouter } from './demo.routes.js';

export const apiRouter = Router();

apiRouter.use(authRouter);
apiRouter.use(profileRouter);
apiRouter.use(medicationRouter);
apiRouter.use(doseRouter);
apiRouter.use(appointmentRouter);
apiRouter.use(notesRouter);
apiRouter.use(aiRouter);
apiRouter.use(demoRouter);

export default apiRouter;
