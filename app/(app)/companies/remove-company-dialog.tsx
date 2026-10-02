"use client";

import { useState } from "react";
import { deleteCompany, type Company } from "@/lib/api/companies";
import { toFormErrors } from "@/lib/api/errors";
import { Modal } from "./modal";

type Props = {
  company: Company;
  onRemoved: (company: Company) => void;
  onClose: () => void;
};

/** Asks before removing; nothing is sent until "Remove company" is clicked. */
export function RemoveCompanyDialog({ company, onRemoved, onClose }: Props) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function remove() {
    setPending(true);
    setError(undefined);
    try {
      await deleteCompany(company.id);
      onRemoved(company);
    } catch (err) {
      setError(toFormErrors(err, []).formError);
      setPending(false);
    }
  }

  return (
    <Modal title={`Remove ${company.name}?`} onClose={onClose}>
      <div className="flex flex-col gap-3 px-6 py-6 text-sm">
        <p>
          {company.name} will no longer be watched or listed here. To stop checking it but keep
          it, pause it instead.
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
