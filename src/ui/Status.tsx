import type { ReactNode } from "react";

/**
 * The message states every screen uses, so the semantics and the styling stay
 * in one place:
 *
 * - `LoadingState` is a polite live region for work in progress;
 * - `EmptyState` is plain text for "there is nothing here yet";
 * - `ErrorState` is an assertive alert for something that failed;
 * - `StatusLine` is a polite live region for progress and confirmations that
 *   are not one of the three states (for example a run's status).
 */
export function LoadingState({ children }: { children: ReactNode }) {
  return (
    <p className="status status--loading" role="status">
      {children}
    </p>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="status status--empty">{children}</p>;
}

export function ErrorState({ children }: { children: ReactNode }) {
  return (
    <p className="status status--error" role="alert">
      {children}
    </p>
  );
}

export function StatusLine({ children }: { children: ReactNode }) {
  return (
    <p className="status status--line" role="status">
      {children}
    </p>
  );
}
