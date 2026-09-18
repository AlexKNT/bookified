"use server";

import { auth } from "@clerk/nextjs/server";
import { Types } from "mongoose";

import connectToDatabase from "@/database/mongoose";
import Book from "@/database/models/book.model";
import BookSegment from "@/database/models/book-segment.model";
import { sampleBooks } from "@/lib/constants";
import { getUserPlan, getPlanLimits } from "@/lib/subscription.server";
import type { IBook, TextSegment } from "@/types";

interface BookSummary {
  _id: string;
  title: string;
  author: string;
  slug: string;
  coverURL: string;
  fileURL?: string;
  fileBlobKey?: string;
  fileSize?: number;
  persona?: string;
  totalSegments?: number;
}

type CreateBookResult =
  | {
      success: true;
      data: BookSummary;
      alreadyExists?: boolean;
      error?: undefined;
      isBillingError?: undefined;
    }
  | {
      success: false;
      data?: undefined;
      alreadyExists?: undefined;
      error: string;
      isBillingError?: boolean;
    };

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const toBookSummary = (book: IBook): BookSummary => ({
  _id: String(book._id),
  title: book.title,
  author: book.author,
  slug: book.slug,
  coverURL: book.coverURL,
  fileURL: book.fileURL,
  fileBlobKey: book.fileBlobKey,
  fileSize: book.fileSize,
  persona: book.persona,
  totalSegments: book.totalSegments,
});

const buildSlug = (title: string) =>
  title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "untitled";

const generateUniqueSlug = async (title: string) => {
  const base = buildSlug(title);
  let slug = base;
  let suffix = 1;

  while (await Book.exists({ slug })) {
    suffix += 1;
    slug = `${base}-${suffix}`;
  }

  return slug;
};

/**
 * The home library: signed-in users see their own books, everyone else sees the
 * bundled sample library (those covers are allow-listed in next.config.ts).
 */
export async function getAllBooks(query?: string) {
  const { userId } = await auth();

  if (!userId) {
    const term = query?.trim().toLowerCase();

    const books = term
      ? sampleBooks.filter(
          (book) =>
            book.title.toLowerCase().includes(term) ||
            book.author.toLowerCase().includes(term),
        )
      : sampleBooks;

    return { success: true, data: books as BookSummary[], isSample: true };
  }

  try {
    await connectToDatabase();

    const filter: Record<string, unknown> = { clerkId: userId };
    const term = query?.trim();

    if (term) {
      const pattern = new RegExp(escapeRegex(term), "i");
      filter.$or = [{ title: pattern }, { author: pattern }];
    }

    const books = await Book.find(filter).sort({ createdAt: -1 }).lean<IBook[]>();

    return { success: true, data: books.map(toBookSummary), isSample: false };
  } catch (error) {
    console.error("getAllBooks failed:", error);
    return { success: false, error: "Failed to load the library" };
  }
}

export async function getBookBySlug(slug: string) {
  const { userId } = await auth();

  if (!userId) {
    return { success: false, error: "Please sign in to read this book" };
  }

  try {
    await connectToDatabase();

    const book = await Book.findOne({ slug, clerkId: userId }).lean<IBook | null>();

    if (!book) {
      return { success: false, error: "Book not found" };
    }

    return { success: true, data: toBookSummary(book) };
  } catch (error) {
    console.error("getBookBySlug failed:", error);
    return { success: false, error: "Failed to load the book" };
  }
}

export async function checkBookExists(title: string) {
  const { userId } = await auth();

  if (!userId) {
    return { exists: false, book: null };
  }

  try {
    await connectToDatabase();

    const book = await Book.findOne({
      clerkId: userId,
      title: new RegExp(`^${escapeRegex(title.trim())}$`, "i"),
    }).lean<IBook | null>();

    return { exists: Boolean(book), book: book ? { slug: book.slug, title: book.title } : null };
  } catch (error) {
    console.error("checkBookExists failed:", error);
    return { exists: false, book: null };
  }
}

export async function createBook(data: {
  clerkId: string;
  title: string;
  author: string;
  persona?: string;
  fileURL: string;
  fileBlobKey: string;
  coverURL: string;
  coverBlobKey?: string;
  fileSize: number;
}): Promise<CreateBookResult> {
  const { userId } = await auth();

  if (!userId) {
    return { success: false, error: "Please sign in to upload books" };
  }

  try {
    await connectToDatabase();

    const existing = await Book.findOne({
      clerkId: userId,
      title: new RegExp(`^${escapeRegex(data.title.trim())}$`, "i"),
    }).lean<IBook | null>();

    if (existing) {
      // UploadForm redirects to the existing book when this flag is set, so this
      // is a successful outcome rather than an error.
      return { success: true, alreadyExists: true, data: toBookSummary(existing) };
    }

    const [plan, limits] = await Promise.all([getUserPlan(), getPlanLimits()]);
    const bookCount = await Book.countDocuments({ clerkId: userId });

    if (bookCount >= limits.maxBooks) {
      return {
        success: false,
        isBillingError: true,
        error: `Your ${plan} plan includes ${limits.maxBooks} book${
          limits.maxBooks === 1 ? "" : "s"
        }. Upgrade to add more.`,
      };
    }

    const slug = await generateUniqueSlug(data.title);

    const book = await Book.create({
      clerkId: userId,
      title: data.title.trim(),
      author: data.author.trim(),
      persona: data.persona,
      slug,
      fileURL: data.fileURL,
      fileBlobKey: data.fileBlobKey,
      coverURL: data.coverURL,
      coverBlobKey: data.coverBlobKey,
      fileSize: data.fileSize,
      totalSegments: 0,
    });

    return { success: true, data: toBookSummary(book.toObject() as IBook) };
  } catch (error) {
    console.error("createBook failed:", error);
    return { success: false, error: "Failed to create the book" };
  }
}

export async function saveBookSegments(
  bookId: string,
  clerkId: string,
  segments: TextSegment[],
) {
  const { userId } = await auth();

  if (!userId || userId !== clerkId) {
    return { success: false, error: "Unauthorized" };
  }

  if (!Types.ObjectId.isValid(bookId)) {
    return { success: false, error: "Invalid book id" };
  }

  try {
    await connectToDatabase();

    if (segments.length > 0) {
      await BookSegment.insertMany(
        segments.map((segment) => ({
          clerkId: userId,
          bookId: new Types.ObjectId(bookId),
          content: segment.text,
          segmentIndex: segment.segmentIndex,
          pageNumber: segment.pageNumber,
          wordCount: segment.wordCount,
        })),
      );
    }

    const totalSegments = await BookSegment.countDocuments({ bookId });

    await Book.updateOne({ _id: bookId, clerkId: userId }, { totalSegments });

    return { success: true };
  } catch (error) {
    console.error("saveBookSegments failed:", error);
    return { success: false, error: "Failed to save book segments" };
  }
}
