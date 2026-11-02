import mongoose from 'mongoose';
import { MONITORING_EVENT_TYPES } from '../config/constants.js';

const monitoringEventSchema = new mongoose.Schema(
  {
    interviewId: { type: mongoose.Schema.Types.ObjectId, ref: 'Interview', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    eventType: { type: String, enum: MONITORING_EVENT_TYPES, required: true },
    severity: { type: String, enum: ['info', 'warning', 'critical'], default: 'warning' },
    countedAsWarning: { type: Boolean, default: false },
    timestamp: { type: Date, default: Date.now },
    durationSeconds: { type: Number, min: 0, default: 0 },
    confidence: { type: Number, min: 0, max: 1, default: 0.85 },
    description: { type: String, required: true, maxlength: 500 },
    // Small numeric/label context from the vision engine (yaw, pitch, faceCount, label...)
    metadata: { type: mongoose.Schema.Types.Mixed, default: undefined },
  },
  { timestamps: true }
);

monitoringEventSchema.index({ interviewId: 1, timestamp: 1 });

const MonitoringEvent = mongoose.model('MonitoringEvent', monitoringEventSchema);
export default MonitoringEvent;
