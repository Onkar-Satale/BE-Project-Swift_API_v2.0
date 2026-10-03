import mongoose from 'mongoose';

// Subdocument schema representing an executed API request entry in user history (V1 + V2 enriched).
const historySchema = new mongoose.Schema(
  {
    method: { type: String, default: 'GET' },
    url: { type: String, default: '' },
    status: { type: mongoose.Schema.Types.Mixed, default: 'OK' },
    duration: { type: Number, default: 0 },
    time: { type: Date, default: Date.now },
    headers: { type: Object, default: {} },
    params: { type: Object, default: {} },
    requestBody: { type: mongoose.Schema.Types.Mixed, default: null },
    responseBody: { type: mongoose.Schema.Types.Mixed, default: null },
    aiDiagnosis: { type: Object, default: null },
    appliedFix: { type: Object, default: null },
    timelineKey: { type: String, default: '' },
  },
  { _id: true }
);

export default historySchema;
