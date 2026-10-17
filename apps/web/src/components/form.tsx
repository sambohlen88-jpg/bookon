/** Labelled form fields for the longer forms (club onboarding). */
import { textInput } from "@/components/ui";

export const fieldLabel = "mb-1.5 block text-sm font-medium";
export const hintText = "mt-1 text-sm text-muted";

export function Field({
  label,
  name,
  hint,
  defaultValue,
  type = "text",
  required = false,
  ...rest
}: {
  label: string;
  name: string;
  hint?: string;
  defaultValue?: string | number | null;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "defaultValue">) {
  const id = `f-${name}`;
  return (
    <div>
      <label htmlFor={id} className={fieldLabel}>
        {label}
        {!required && <span className="font-normal text-muted"> (optional)</span>}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue ?? undefined}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className={textInput}
        {...rest}
      />
      {hint && (
        <p id={`${id}-hint`} className={hintText}>
          {hint}
        </p>
      )}
    </div>
  );
}

export function TextArea({
  label,
  name,
  hint,
  defaultValue,
  required = false,
  maxLength = 1000,
  rows = 3,
}: {
  label: string;
  name: string;
  hint?: string;
  defaultValue?: string | null;
  required?: boolean;
  maxLength?: number;
  rows?: number;
}) {
  const id = `f-${name}`;
  return (
    <div>
      <label htmlFor={id} className={fieldLabel}>
        {label}
        {!required && <span className="font-normal text-muted"> (optional)</span>}
      </label>
      <textarea
        id={id}
        name={name}
        required={required}
        rows={rows}
        maxLength={maxLength}
        defaultValue={defaultValue ?? undefined}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className={`${textInput} py-3`}
      />
      {hint && (
        <p id={`${id}-hint`} className={hintText}>
          {hint}
        </p>
      )}
    </div>
  );
}

export function Select({
  label,
  name,
  options,
  defaultValue,
  hint,
  required = false,
}: {
  label: string;
  name: string;
  options: Record<string, string>;
  defaultValue?: string | null;
  hint?: string;
  required?: boolean;
}) {
  const id = `f-${name}`;
  return (
    <div>
      <label htmlFor={id} className={fieldLabel}>
        {label}
        {!required && <span className="font-normal text-muted"> (optional)</span>}
      </label>
      <select
        id={id}
        name={name}
        required={required}
        defaultValue={defaultValue ?? ""}
        className={textInput}
      >
        <option value="" disabled={required}>
          {required ? "Choose one" : "Not sure"}
        </option>
        {Object.entries(options).map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
      {hint && <p className={hintText}>{hint}</p>}
    </div>
  );
}

export function Checkbox({
  name,
  value = "1",
  defaultChecked,
  children,
}: {
  name: string;
  value?: string;
  defaultChecked?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex min-h-11 items-start gap-3 py-2">
      <input
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        className="mt-0.5 size-5 shrink-0 accent-brand"
      />
      <span>{children}</span>
    </label>
  );
}

export function Fieldset({
  legend,
  hint,
  children,
}: {
  legend: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="rounded-xl border border-border p-4 md:p-6">
      <legend className="px-1 text-lg font-semibold">{legend}</legend>
      {hint && <p className="mb-4 text-sm text-muted">{hint}</p>}
      <div className="flex flex-col gap-4">{children}</div>
    </fieldset>
  );
}
