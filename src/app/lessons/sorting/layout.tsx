import type { ReactNode } from "react";
import { LessonArticle } from "@/components/LessonArticle";

export default function SortingLayout({ children }: { children: ReactNode }) {
  return <LessonArticle>{children}</LessonArticle>;
}
