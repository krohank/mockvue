import express from 'express';
import {
  generateInterview,
  getInterview,
  startInterview,
  submitAnswer,
  completeInterview,
  getHistory,
  getReport,
  deleteInterview,
} from '../controllers/interview.controller.js';
import { logMonitoringEvent, getMonitoringEvents } from '../controllers/analytics.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(protect);

router.post('/generate', generateInterview);
router.get('/history', getHistory);
router.get('/:id', getInterview);
router.delete('/:id', deleteInterview);
router.post('/:id/start', startInterview);
router.post('/:id/answer', submitAnswer);
router.post('/:id/complete', completeInterview);
router.get('/:id/report', getReport);
router.post('/:id/monitoring', logMonitoringEvent);
router.get('/:id/monitoring', getMonitoringEvents);

export default router;
