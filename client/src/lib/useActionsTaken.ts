import { useCallback, useEffect, useState } from "react";
import {
  createActionTaken,
  getActionsTaken,
  updateActionTaken,
  type ActionTaken,
  type ActionTakenFields,
} from "../api.js";

export type ActionsState = "loading" | "loaded" | "error";

// Owns the Actions Taken list for one Ticket so a screen can show the count
// in a tab label and hand the same data to the panel.
export function useActionsTaken(ticketId: number) {
  const [items, setItems] = useState<ActionTaken[]>([]);
  const [state, setState] = useState<ActionsState>("loading");

  const reload = useCallback(() => {
    setState("loading");
    getActionsTaken(ticketId)
      .then((data) => {
        setItems(data);
        setState("loaded");
      })
      .catch(() => setState("error"));
  }, [ticketId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const create = useCallback(
    async (fields: ActionTakenFields, idempotencyKey: string): Promise<{ alreadySaved: boolean }> => {
      const { action: created, alreadySaved } = await createActionTaken(ticketId, fields, idempotencyKey);
      // A retried request with the same key returns the original (BR-13).
      setItems((prev) => (prev.some((a) => a.id === created.id) ? prev : [...prev, created]));
      return { alreadySaved };
    },
    [ticketId],
  );

  const update = useCallback(
    async (actionId: number, fields: ActionTakenFields) => {
      const updated = await updateActionTaken(ticketId, actionId, fields);
      setItems((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    },
    [ticketId],
  );

  return { items, state, reload, create, update };
}
