import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import BookCard from "@/components/BookCard";
import type { BookCardProps } from "@/types";

const book: BookCardProps = {
  title: "A Test Book",
  author: "A Test Author",
  coverURL: "https://example.test/cover.jpg",
  slug: "a-test-book",
};

describe("BookCard", () => {
  it("shows the title, the author, and the page a reader follows", () => {
    render(<BookCard {...book} />);

    expect(screen.getByRole("heading", { name: book.title })).toBeInTheDocument();
    expect(screen.getByText(book.author)).toBeInTheDocument();
    // The card's own link, whose accessible name comes from the whole card.
    expect(screen.getByRole("link")).toHaveAttribute("href", `/books/${book.slug}`);
  });

  it("describes the cover with the title, for a reader who cannot see it", () => {
    render(<BookCard {...book} />);

    expect(screen.getByRole("img", { name: book.title })).toHaveAttribute("src", book.coverURL);
  });
});
