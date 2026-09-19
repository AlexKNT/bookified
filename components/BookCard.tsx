import Link from "next/link";
import {BookCardProps} from "@/types";
import Image from "next/image";

const BookCard = ({ title, author, coverURL, slug }: BookCardProps) => {
    return (
        <Link href={`/books/${slug}`}>
            <article className="book-card">
                <figure className="book-card-figure">
                    <div className="book-card-cover-wrapper">
                        {/* width/height only declare the nominal 2:3 cover ratio; the rendered
                            size comes from .book-card-cover (w-auto + fixed height). Keeping
                            both axes different from the CSS box avoids Next.js' warning about
                            changing only one side of the aspect ratio. */}
                        <Image
                            src={coverURL}
                            alt={title}
                            width={400}
                            height={600}
                            className="book-card-cover"
                        />
                    </div>

                    <figcaption className="book-card-meta">
                        <h3 className="book-card-title">{title}</h3>
                        <p className="book-card-author">{author}</p>
                    </figcaption>
                </figure>
            </article>
        </Link>
    )
}
export default BookCard;