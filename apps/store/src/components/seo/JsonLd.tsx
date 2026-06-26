import { removeEmpty } from "@/lib/seo/jsonld";

/** Safe JSON-LD renderer — skill §12.1. Escapes < to prevent XSS. */
export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(removeEmpty(data)).replace(/</g, "\\u003c"),
      }}
    />
  );
}
