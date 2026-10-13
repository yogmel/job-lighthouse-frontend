type Props = {
  /** Prefix for the input id, unique per form (e.g. "add"). */
  idPrefix: string;
  name: string;
  label: string;
  type?: "text" | "url";
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
  error?: string;
  /** Note under the input. */
  hint?: string;
  /** Native validation: regex the value must match, and the message shown when it doesn't. */
  pattern?: string;
  patternMessage?: string;
};

export function Field({
  idPrefix,
  name,
  label,
  type = "text",
  required = true,
  placeholder,
  defaultValue,
  error,
  hint,
  pattern,
  patternMessage,
}: Props) {
  const id = `${idPrefix}-${name}`;
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        aria-invalid={error ? true : undefined}
        pattern={pattern}
        title={patternMessage}
        aria-describedby={describedBy}
        className="rounded-md border border-divider bg-field px-3 py-2 text-sm outline-none focus:border-accent aria-invalid:border-danger"
      />
      {hint && (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
