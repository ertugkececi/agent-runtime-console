import { runStatusLabel } from "../runs/run";
import { eventDetails, eventLabel, formatTime } from "../runs/run";
import { EmptyState, StatusLine } from "../ui/Status";
import type { ChatRun } from "./chat";

/**
 * The live status and `run_events` timeline of one run. The status line is a
 * live region, so a change from `queued` to `running` to `completed` is
 * announced; the list grows as the run reports events.
 */
export function RunTimeline({ run }: { run: ChatRun }) {
  return (
    <section aria-labelledby="chat-run-heading">
      <h3 id="chat-run-heading">Çalıştırma zaman çizelgesi</h3>
      <StatusLine>
        {runStatusLabel(run.status)} · Çalıştırma {run.id}
        {run.queue ? ` · Deneme ${run.queue.attempts}/${run.queue.max_attempts}` : ""}
        {run.error_code ? ` · ${run.error_code}` : ""}
      </StatusLine>
      {run.events.length === 0 ? (
        <EmptyState>Henüz olay yok.</EmptyState>
      ) : (
        <ol aria-label="Çalıştırma olayları">
          {run.events.map((event) => (
            <li key={event.sequence}>
              {formatTime(event.created_at)} · {eventLabel(event.type)}
              {eventDetails(event).map((detail) => (
                <span key={detail}> · {detail}</span>
              ))}
            </li>
          ))}
        </ol>
      )}
      <p>
        <small>
          Olay ayrıntıları yalnızca tanımlayıcı, durum ve hata kodu alanlarını gösterir. Araç
          çağrısı olayları görünür, ancak argümanları veya içeriği hiçbir zaman gösterilmez.
        </small>
      </p>
    </section>
  );
}
