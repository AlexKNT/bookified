import { Schema, model, models, type Model } from "mongoose";
import type { IVoiceSession } from "@/types";

const VoiceSessionSchema = new Schema<IVoiceSession>(
  {
    clerkId: { type: String, required: true, index: true },
    bookId: { type: Schema.Types.ObjectId, ref: "Book", required: true },
    startedAt: { type: Date, required: true, default: Date.now },
    endedAt: { type: Date },
    durationSeconds: { type: Number, required: true, default: 0 },
    billingPeriodStart: { type: Date, required: true, index: true },
  },
  { timestamps: true },
);

// Monthly usage is counted per user within a billing period.
VoiceSessionSchema.index({ clerkId: 1, billingPeriodStart: 1 });

const VoiceSession: Model<IVoiceSession> =
  (models.VoiceSession as Model<IVoiceSession>) ??
  model<IVoiceSession>("VoiceSession", VoiceSessionSchema);

export default VoiceSession;
