import type { ReactNode } from "react";
import { LessonArticle } from "@/components/LessonArticle";

export default function MlLayout({ children }: { children: ReactNode }) {
  return <LessonArticle>{children}</LessonArticle>;
}
