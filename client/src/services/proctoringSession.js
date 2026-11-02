import { session } from '../lib/storage';

/** Hand-off from the system check to the interview room (same browser tab). */
const key = (interviewId) => `mockvue_proctoring_${interviewId}`;

export const saveProctoringSetup = (interviewId, setup) => session.set(key(interviewId), { ...setup, savedAt: Date.now() });

export const loadProctoringSetup = (interviewId) => session.get(key(interviewId), null);

export const clearProctoringSetup = (interviewId) => session.remove(key(interviewId));
