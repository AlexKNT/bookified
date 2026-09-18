import { Schema, model, models, type Model } from "mongoose";
import type { IBookSegment } from "@/types";

const BookSegmentSchema = new Schema<IBookSegment>(
  {
    clerkId: { type: String, required: true, index: true },
    bookId: { type: Schema.Types.ObjectId, ref: "Book", required: true, index: true },
    content: { type: String, required: true },
    segmentIndex: { type: Number, required: true },
    pageNumber: { type: Number },
    wordCount: { type: Number, required: true },
  },
  { timestamps: true },
);

// Ordered lookup of a book's segments is the hot path for the voice assistant.
BookSegmentSchema.index({ bookId: 1, segmentIndex: 1 });

const BookSegment: Model<IBookSegment> =
  (models.BookSegment as Model<IBookSegment>) ??
  model<IBookSegment>("BookSegment", BookSegmentSchema);

export default BookSegment;
