import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Human Reflections | Naveen",
  description:
    "Clear reflections on life, evolution, consciousness, the universe, and scientific curiosity.",
};

export default function ReflectionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}