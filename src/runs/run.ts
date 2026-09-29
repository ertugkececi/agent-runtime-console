// Run-level render rules shared by the chat and group room screens.
//
// Both screens follow `GET /runs/{run_id}`, and the platform reports the same
// statuses for a chat run and a room run. Only a status the platform reports
// may end the follow loop: anything else, including a status this console does
// not know yet, keeps being treated as unfinished.

const RUN_STATUS_LABELS: Record<string, string> = {
  queued: "Sırada",
  running: "Çalışıyor",
  completed: "Tamamlandı",
  failed: "Başarısız",
};

export function runStatusLabel(status: string): string {
  return RUN_STATUS_LABELS[status] ?? status;
}

/** A run is terminal only when the platform says so. */
export function isTerminalStatus(status: string): boolean {
  return status === "completed" || status === "failed";
}

export function isActiveStatus(status: string): boolean {
  return status === "queued" || status === "running";
}
