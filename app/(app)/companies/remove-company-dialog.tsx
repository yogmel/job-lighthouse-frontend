"use client";

import { useState } from "react";
import { deleteCompany, type Company } from "@/lib/api/companies";
import { ApiError } from "@/lib/api/client";
import { toFormErrors } from "@/lib/api/errors";
import { Modal } from "./modal";

type Props = {
  company: Company;
  onRemoved: (company: Company) => void;
  /** The company was already gone (404): the list needs a refresh. */
  onGone: (company: Company) => void;
  onClose: () => void;
};

/** Asks before removing; nothing is sent until "Remove company" is clicked. */
export function RemoveCompanyDialog({ company, onRemoved, onGone, onClose }: Props) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function remove() {
    setPending(true);
    setError(undefined);
    try {
      await deleteCompany(company.id);
      onRemoved(company);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        onGone(company);
        return;
      }
      // 409 ("A run is in progress") lands here: the dialog stays open so the user can retry.
      setError(toFormErrors(err, []).formError);
      setPending(false);
    }
  }

  return (
    <Modal title={`Remove ${company.name}?`} onClose={onClose}>
      <div className="flex flex-col gap-3 px-6 py-6 text-sm">
        <p>
          {company.name} and all of its jobs will be deleted. Past runs are kept. To stop checking it
          but keep its jobs, pause it instead.
        </p>
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
          disabled={pending}
          className="rounded-md bg-danger px-4 py-2 text-sm font-semibold text-background disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Removing…" : "Remove company"}
        </button>
      </div>
    </Modal>
  );
}
