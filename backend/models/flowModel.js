import mongoose from 'mongoose';

// Schema for extracted variable dependencies between flow steps
const variableExtractionSchema = new mongoose.Schema({
  varName: { type: String, required: true }, // e.g., "authToken", "orderId"
  jsonPath: { type: String, required: true }, // e.g., "token", "data.user.id", "id"
  description: { type: String, default: '' }
}, { _id: false });

// Schema for individual steps in a multi-step API flow
const flowStepSchema = new mongoose.Schema({
  stepId: { type: String, required: true }, // unique step identifier
  name: { type: String, required: true },
  method: {
    type: String,
    enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    default: 'GET'
  },
  url: { type: String, required: true }, // supports {{varName}} placeholders
  headers: { type: mongoose.Schema.Types.Mixed, default: [] },
  params: { type: mongoose.Schema.Types.Mixed, default: [] },
  body: { type: mongoose.Schema.Types.Mixed, default: null },
  bodyType: { type: String, default: 'none' },
  auth: { type: mongoose.Schema.Types.Mixed, default: { type: 'none', token: '', username: '', password: '' } },
  settings: { type: mongoose.Schema.Types.Mixed, default: { expectedStatus: 200 } },
  extractVariables: { type: [variableExtractionSchema], default: [] },
  expectedStatus: { type: Number, default: 200 }
}, { _id: false, strict: false });

// Schema for individual execution step run results
const stepRunResultSchema = new mongoose.Schema({
  stepId: { type: String },
  name: { type: String },
  method: { type: String },
  url: { type: String },
  status: { type: mongoose.Schema.Types.Mixed },
  duration: { type: Number, default: 0 },
  passed: { type: Boolean, default: false },
  error: { type: String, default: null },
  extracted: { type: Object, default: {} },
  healed: { type: Boolean, default: false },
  healingDetails: { type: Object, default: null }
}, { _id: false });

// Main Schema for Multi-Step API Flow with Autonomous Self-Healing support
const flowSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User_SwiftAPI',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: [true, 'Flow name is required'],
    trim: true
  },
  description: {
    type: String,
    default: '',
    trim: true
  },
  steps: {
    type: [flowStepSchema],
    default: []
  },
  initialVariables: {
    type: Object,
    default: {}
  },
  lastRun: {
    runId: { type: String },
    timestamp: { type: Date },
    passed: { type: Boolean, default: false },
    totalSteps: { type: Number, default: 0 },
    healedStepsCount: { type: Number, default: 0 },
    duration: { type: Number, default: 0 },
    stepResults: { type: [stepRunResultSchema], default: [] }
  }
}, { timestamps: true });

export default mongoose.model('Flow_SwiftAPI', flowSchema, 'swiftapiv2_flows');
