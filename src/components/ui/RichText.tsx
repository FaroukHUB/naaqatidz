import { PortableText, type PortableTextBlock } from "next-sanity";

export function RichText({ value }: { value: PortableTextBlock[] | null }) {
  if (!value?.length) return null;
  return (
    <div className="prose-naaqati">
      <PortableText value={value} />
    </div>
  );
}
