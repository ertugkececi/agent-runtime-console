import { isActiveStatus, runStatusLabel } from "../runs/run";
import { splitRoomTurns, type RoomRun } from "./room";

/**
 * One room run: the task, every participant contribution in speaking order,
 * and the moderator's closing answer — separated by each turn's `phase`. A run
 * that failed shows its error code.
 */
export function RoomRunView({ run }: { run: RoomRun }) {
  const { participantTurns, summaryTurn } = splitRoomTurns(run.turns);
  const finalAnswer = run.final_answer ?? summaryTurn?.content ?? null;
  const summaryLabel =
    summaryTurn !== undefined ? `Moderatör · ${summaryTurn.agent_name}` : "Moderatör";

  return (
    <article aria-label={`Çalıştırma ${run.id}`}>
      <p>
        <strong>Görev:</strong> {run.content}
      </p>
      <p>
        <small>
          Çalıştırma {run.id} · {runStatusLabel(run.status)}
          {run.error_code !== null ? ` · ${run.error_code}` : ""}
        </small>
      </p>
      <ol aria-label="Katkılar">
        {participantTurns.map((turn) => (
          <li key={turn.position}>
            <strong>{turn.agent_name}:</strong>{" "}
            {turn.content !== null && turn.content !== ""
              ? turn.content
              : `Durum: ${runStatusLabel(turn.status)}`}
          </li>
        ))}
      </ol>
      {finalAnswer !== null ? (
        <p>
          <strong>{summaryLabel}:</strong> {finalAnswer}
        </p>
      ) : summaryTurn !== undefined && !isActiveStatus(run.status) ? (
        <p>
          <strong>{summaryLabel}:</strong> Durum: {runStatusLabel(summaryTurn.status)}
        </p>
      ) : null}
    </article>
  );
}
