import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { CircleAlert, Search } from 'lucide-react';
import { cx } from '@/lib/cx';

const control =
  'w-full rounded-field border bg-surface px-3 text-sm text-text outline-none transition-colors placeholder:text-text-muted/70 ' +
  'focus:border-primary focus:ring-3 focus:ring-primary-tint-strong disabled:bg-surface-muted disabled:text-text-muted';

const state = (error?: string) => (error ? 'border-danger focus:border-danger focus:ring-danger-tint' : 'border-border');

interface FieldShellProps {
  label: string;
  hint?: ReactNode;
  error?: string;
  id: string;
  children: ReactNode;
}

function FieldShell({ label, hint, error, id, children }: FieldShellProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-semibold text-text">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-msg`} className="flex items-center gap-1.5 text-[12.5px] font-medium text-danger">
          <CircleAlert size={14} aria-hidden /> {error}
        </p>
      ) : hint ? (
        <p id={`${id}-msg`} className="text-[12.5px] text-text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: ReactNode;
  error?: string;
}

export function TextField({ label, hint, error, className, ...rest }: TextFieldProps) {
  const id = useId();
  return (
    <FieldShell label={label} hint={hint} error={error} id={id}>
      <input
        id={id}
        aria-invalid={!!error}
        aria-describedby={hint || error ? `${id}-msg` : undefined}
        className={cx(control, state(error), 'h-10', className)}
        {...rest}
      />
    </FieldShell>
  );
}

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  hint?: ReactNode;
  error?: string;
}

export function SelectField({ label, hint, error, className, children, ...rest }: SelectFieldProps) {
  const id = useId();
  return (
    <FieldShell label={label} hint={hint} error={error} id={id}>
      <select id={id} aria-invalid={!!error} className={cx(control, state(error), 'h-10 pr-8', className)} {...rest}>
        {children}
      </select>
    </FieldShell>
  );
}

interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: ReactNode;
  error?: string;
}

export function TextAreaField({ label, hint, error, className, ...rest }: TextAreaFieldProps) {
  const id = useId();
  return (
    <FieldShell label={label} hint={hint} error={error} id={id}>
      <textarea id={id} aria-invalid={!!error} className={cx(control, state(error), 'min-h-20 py-2.5', className)} {...rest} />
    </FieldShell>
  );
}

/** Buscador tipo pastilla, para el header y los filtros de tablas. */
export function SearchInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={cx('relative', className)}>
      <Search size={16} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-text-muted" aria-hidden />
      <input
        type="search"
        className="h-10 w-full rounded-full border border-border bg-surface pr-4 pl-10 text-sm outline-none placeholder:text-text-muted/70 focus:border-primary focus:ring-3 focus:ring-primary-tint-strong"
        {...rest}
      />
    </div>
  );
}
