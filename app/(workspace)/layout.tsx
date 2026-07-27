import MainContent from '../components/MainContent';

export default function WorkspaceLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <MainContent>{children}</MainContent>;
}
