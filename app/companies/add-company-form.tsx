"use client";

import { useState, type FormEvent } from "react";
import { createCompany, type Company } from "@/lib/api/companies";
import { toFormErrors, type FormErrors } from "@/lib/api/errors";
import { COMPANY_FIELDS, CompanyFields, readCompanyInput, type CompanyField } from "./company-fields";
import { Modal } from "./modal";

type Props = {
  onCreated: (company: Company) => void;
  onClose: () => void;
};

export function AddCompanyForm({ onCreated, onClose }: Props) {
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<FormErrors<CompanyField>>({ fieldErrors: {} });

  // onSubmit rather than a form action: an action resets the fields, and a
  // rejected submit should keep what the user typed.
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const input = readCompanyInput(new FormData(e.currentTarget));
    setPending(true);
    setErrors({ fieldErrors: {} });
    try {
      onCreated(await createCompany(input));
    } catch (err) {
      setErrors(toFormErrors(err, COMPANY_FIELDS));
      setPending(false);
    }
  }

  return (
    <Modal title="Add company" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="flex flex-col gap-4 px-6 py-6">
          <CompanyFields idPrefix="add" errors={errors.fieldErrors} />
          {errors.formError && (
            <p role="alert" className="text-sm text-danger">
              {errors.formError}
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-divider px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-sm font-semibold">
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Adding…" : "Add company"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
