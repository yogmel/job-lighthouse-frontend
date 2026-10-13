"use client";

import { useEffect, useRef, useState } from "react";
import { Modal } from "@/app/(app)/modal";
import { exportAccount } from "@/lib/api/account";
import { toFormErrors } from "@/lib/api/errors";
import { downloadJson } from "@/lib/download";

type Props = {
  onClose: () => void;
};

function exportFilename(now = new Date()): string {
  return `job-lighthouse-export-${now.toISOString().slice(0, 10)}.json`;
}

/** Asks before exporting; nothing is fetched until "Export JSON" is clicked. */
export function ExportAccountDialog({ onClose }: Props) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  // Cancel / Esc while the request is pending: drop the response, download nothing.
  const closed = useRef(false);
  useEffect(() => {
    closed.current = false;
    return () => {
      closed.current = true;
    };
  }, []);

  async function exportData() {
    setPending(true);
    setError(undefined);
    try {
      const data = await exportAccount();
      if (closed.current) return;
      downloadJson(data, exportFilename());
      onClose();
    } catch (err) {
      if (closed.current) return;
      setError(toFormErrors(err, []).formError ?? "Something went wrong. Please try again.");
      setPending(false);
    }
  }

  return (
    <Modal title="Export your data?" onClose={onClose}>
      <div className="flex flex-col gap-3 px-6 py-6 text-sm">
        <p>
          This downloads all your data — companies, jobs, runs and config — as one JSON file.
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
          onClick={exportData}
          disabled={pending}
          className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Exporting…" : "Export JSON"}
        </button>
      </div>
    </Modal>
  );
}
