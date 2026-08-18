'use client';

type WorkspaceHeaderProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function IconMenu() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden
    >
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="17" x2="20" y2="17" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export default function WorkspaceHeader({ open, onOpenChange }: WorkspaceHeaderProps) {
  return (
    <header className="workspace-header">
      <div className="workspace-header-inner">
        <button
          type="button"
          className="workspace-menu-trigger"
          aria-label={open ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={open}
          onClick={() => onOpenChange(!open)}
        >
          {open ? <IconClose /> : <IconMenu />}
        </button>
      </div>
    </header>
  );
}
