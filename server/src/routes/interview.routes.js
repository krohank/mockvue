import express from 'express';
import {
  generateInterview,
  getInterview,
  startInterview,
  submitAnswer,
  saveDraft,
  completeInterview,
  getHistory,
  getReport,
  evaluateSavedAnswers,
} from '../controllers/interview.controller.js';
import {
  logMonitoringEvent,
  getMonitoringEvents,
} from '../controllers/analytics.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(protect); // All interview operations require authentication

router.post('/generate', generateInterview);
router.get('/history', getHistory);
router.get('/:id', getInterview);
router.post('/:id/start', startInterview);
router.post('/:id/answer', submitAnswer);
router.put('/:id/draft', saveDraft);
router.post('/:id/complete', completeInterview);
router.get('/:id/report', getReport);
router.post('/:id/evaluate', evaluateSavedAnswers);

// Direct interview monitoring endpoints (prevents 404 broken routes)
router.post('/:id/monitoring', logMonitoringEvent);
router.get('/:id/monitoring', getMonitoringEvents);

export default router;
