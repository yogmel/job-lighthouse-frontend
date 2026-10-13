"use client";

import { Modal } from "./modal";

type Props = {
  /** The company a Single-company run is for; omitted for a Full run. */
  companyName?: string;
  onConfirm: () => void;
  onClose: () => void;
};

/** Asks before `POST /runs`, for a Full run or a Single-company run. Nothing starts on Cancel. */
export function RunConfirmDialog({ companyName, onConfirm, onClose }: Props) {
  return (
    <Modal title={companyName ? `Run ${companyName} now?` : "Run now?"} onClose={onClose}>
      <div className="px-6 py-6 text-sm">
        <p>
          {companyName
            ? `This checks ${companyName} for new openings and scores them.`
            : "This checks every active company for new openings and scores them."}
        </p>
      </div>
      <div className="flex justify-end gap-2 border-t border-divider px-6 py-4">
        <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-sm font-semibold">
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-strong"
        >
          Start run
        </button>
      </div>
    </Modal>
  );
}
