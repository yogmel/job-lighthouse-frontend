"use client";

import { useState } from "react";
import { Modal } from "@/app/(app)/companies/modal";
import { deleteAccount } from "@/lib/api/account";
import { toFormErrors } from "@/lib/api/errors";

type Props = {
  email: string;
  onDeleted: () => void;
  onClose: () => void;
};

/**
 * Explicit confirmation: nothing is sent until the user types their email
 * and clicks "Delete account".
 */
export function DeleteAccountDialog({ email, onDeleted, onClose }: Props) {
  const [typed, setTyped] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const confirmed = typed.trim().toLowerCase() === email.toLowerCase();

  async function remove() {
    if (!confirmed) return;
    setPending(true);
    setError(undefined);
    try {
      await deleteAccount();
      onDeleted();
    } catch (err) {
      setError(toFormErrors(err, []).formError);
      setPending(false);
    }
  }

  return (
    <Modal title="Delete your account?" onClose={onClose}>
      <div className="flex flex-col gap-3 px-6 py-6 text-sm">
        <p>
          This permanently removes your companies, jobs, run history, profile and settings. It
          cannot be undone. Export your data first if you want a copy.
        </p>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="delete-confirm" className="font-medium">
            Type <strong>{email}</strong> to confirm
          </label>
          <input
            id="delete-confirm"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            className="rounded-md border border-divider bg-field px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>
        {error && (
          <p role="alert" className="text-danger">
            {error}
          </p>
        )}
      </div>
      <div className="flex justify-end gap-2 border-t border-divider px-6 py-4">
        <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-sm font-semibold">
          Cancel
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={!confirmed || pending}
          className="rounded-md bg-danger px-4 py-2 text-sm font-semibold text-background disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Deleting…" : "Delete account"}
        </button>
      </div>
    </Modal>
  );
}
