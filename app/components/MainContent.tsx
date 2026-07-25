import { ReactNode } from 'react';

interface MainContentProps {
  children: ReactNode;
}

export default function MainContent({ children }: MainContentProps) {
  return (
    <main className="flex min-h-dvh w-full flex-col">
      {children}
    </main>
  );
}

