import { Schema, model, models, type Model } from "mongoose";
import type { IBook } from "@/types";

const BookSchema = new Schema<IBook>(
  {
    clerkId: { type: String, required: true, index: true },
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, index: true },
    author: { type: String, required: true, trim: true },
    persona: { type: String },
    fileURL: { type: String, required: true },
    fileBlobKey: { type: String, required: true },
    coverURL: { type: String },
    coverBlobKey: { type: String },
    fileSize: { type: Number, required: true },
    totalSegments: { type: Number, default: 0 },
  },
  { timestamps: true },
);

const Book: Model<IBook> = (models.Book as Model<IBook>) ?? model<IBook>("Book", BookSchema);

export default Book;
