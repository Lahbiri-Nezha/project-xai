"use client";

import { ReactNode } from "react";

interface BentoGridProps {
  children: ReactNode;
  className?: string;
}

export default function BentoGrid({ children, className = "" }: BentoGridProps) {
  return (
    <div
      className={`grid grid-cols-1 md:grid-cols-3 gap-4 auto-rows-[minmax(220px,auto)] ${className}`}
    >
      {children}
    </div>
  );
}
