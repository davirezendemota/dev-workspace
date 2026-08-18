import { ReactNode } from 'react';

interface MainContentProps {
  children: ReactNode;
}

export default function MainContent({ children }: MainContentProps) {
  return (
    <main className="flex h-dvh w-full flex-col overflow-hidden">
      {children}
    </main>
  );
}

