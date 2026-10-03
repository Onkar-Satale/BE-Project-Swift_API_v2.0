import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import historySchema from './historyModel.js';

// Episode schema for History-Grounded RAG resolution memories (Failure -> Diagnosis -> Fix -> Success)
const resolutionEpisodeSchema = new mongoose.Schema({
  episodeId: { type: String, default: '' },
  timestamp: { type: Date, default: Date.now },
  method: { type: String, default: 'GET' },
  url: { type: String, default: '' },
  failedStatus: { type: mongoose.Schema.Types.Mixed, default: 500 },
  errorSnippet: { type: String, default: '' },
  rootCauseLayer: { type: String, default: 'General' },
  appliedFix: { type: Object, default: {} },
  successStatus: { type: mongoose.Schema.Types.Mixed, default: 200 },
  successDuration: { type: Number, default: 0 }
}, { _id: true });

// User Schema definition for authentication, history logs, access tokens, and RAG resolution memories.
const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, "First name is required"],
    trim: true,
  },
  lastName: {
    type: String,
    trim: true,
  },
  email: {
    type: String,
    required: [true, "Email is required"],
    unique: true,
    lowercase: true,
    trim: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      "Please fill a valid email address"
    ]
  },
  password: {
    type: String,
    required: [true, "Password is required"],
    minlength: [8, "Password must be at least 8 characters long"],
    select: false
  },
  reqCount: {
    type: Number, default: 0
  },
  history: {
    type: [historySchema], default: []
  },
  resolutionEpisodes: {
    type: [resolutionEpisodeSchema], default: []
  },
  refreshToken: {
    type: String,
    select: false
  }
}, { timestamps: true });

// Mongoose pre-save hook to hash user passwords using bcrypt (12 salt rounds).
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 12);
});

// Instance method to compare plain password with stored bcrypt hash.
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Custom toJSON method ensuring sensitive fields (password, refreshToken) are omitted from JSON outputs.
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.refreshToken;
  return obj;
};

export default mongoose.model("User_SwiftAPI", userSchema, "swiftapiv2_users");
