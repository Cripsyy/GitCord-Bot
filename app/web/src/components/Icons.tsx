export function HomeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L12 3l9 6.5V21a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

export function GearIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

export function ClipboardIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <line x1="12" y1="11" x2="12" y2="17" />
      <line x1="9" y1="14" x2="15" y2="14" />
    </svg>
  );
}

export function WebhookIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" stroke="currentColor">
      <path d="M17.974 7A4.967 4.967 0 0 0 18 6.5a5.5 5.5 0 1 0-8.672 4.491L7.18 15.114A2.428 2.428 0 0 0 6.496 15 2.5 2.5 0 1 0 9 17.496a2.36 2.36 0 0 0-.93-1.925l2.576-4.943-.41-.241A4.5 4.5 0 1 1 17 6.5a4.8 4.8 0 0 1-.022.452zM6.503 18.999a1.5 1.5 0 1 1 1.496-1.503A1.518 1.518 0 0 1 6.503 19zM18.5 12a5.735 5.735 0 0 0-1.453.157l-2.744-3.941A2.414 2.414 0 0 0 15 6.5a2.544 2.544 0 1 0-1.518 2.284l3.17 4.557.36-.13A4.267 4.267 0 0 1 18.5 13a4.5 4.5 0 1 1-.008 9h-.006a4.684 4.684 0 0 1-3.12-1.355l-.703.71A5.653 5.653 0 0 0 18.49 23h.011a5.5 5.5 0 0 0 0-11zM11 6.5A1.5 1.5 0 1 1 12.5 8 1.509 1.509 0 0 1 11 6.5zM18.5 20a2.5 2.5 0 1 0-2.447-3h-5.05l-.003.497A4.546 4.546 0 0 1 6.5 22 4.526 4.526 0 0 1 2 17.5a4.596 4.596 0 0 1 3.148-4.37l-.296-.954A5.606 5.606 0 0 0 1 17.5 5.532 5.532 0 0 0 6.5 23a5.573 5.573 0 0 0 5.478-5h4.08a2.487 2.487 0 0 0 2.442 2zm0-4a1.5 1.5 0 1 1-1.5 1.5 1.509 1.509 0 0 1 1.5-1.5z" />
    </svg>
  );
}

export function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      className={`transition-transform ${open ? "rotate-90" : ""}`}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

export function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

export function ListIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

export function GridIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </svg>
  );
}
