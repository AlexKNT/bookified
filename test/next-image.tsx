interface NextImageStubProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
}

/**
 * Stands in for `next/image` in the DOM project. It renders the same plain
 * image a reader's browser would end up with, which is all a test needs: the
 * alt text, the source, and the box.
 */
const NextImageStub = ({ src, alt, width, height, className }: NextImageStubProps) => (
  // eslint-disable-next-line @next/next/no-img-element
  <img src={src} alt={alt} width={width} height={height} className={className} />
);

export default NextImageStub;
