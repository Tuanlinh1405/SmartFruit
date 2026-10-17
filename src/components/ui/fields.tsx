import { useId, useState, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes, type ReactNode, type Ref } from 'react';

interface FieldProps { label: string; error?: string; hint?: string; }
function Field({ id, label, error, hint, required, children }: FieldProps & { id: string; required?: boolean; children: ReactNode }) {
  return <div className="field"><label className="field-label" htmlFor={id}>{label}{required && <span aria-hidden="true"> *</span>}</label>{children}{hint && <p id={`${id}-hint`} className="field-hint">{hint}</p>}{error && <p id={`${id}-error`} className="field-error" role="alert">{error}</p>}</div>;
}
function describedBy(id: string, hint?: string, error?: string) { return [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined; }
export interface TextFieldProps extends FieldProps, InputHTMLAttributes<HTMLInputElement> {}
export function TextField({ label, error, hint, id: suppliedId, className = '', ...props }: TextFieldProps) {
  const generatedId = useId(); const id = suppliedId ?? generatedId;
  return <Field {...{ id, label, error, hint }} required={props.required}><input id={id} className={`control ${className}`} aria-invalid={!!error} aria-describedby={describedBy(id, hint, error)} {...props} /></Field>;
}
export function DateInput(props: Omit<TextFieldProps, 'type'>) { return <TextField {...props} type="date" />; }
export function NumberWithUnit({ unit, ...props }: Omit<TextFieldProps, 'type'> & { unit: string }) {
  const generatedId = useId(); const id = props.id ?? generatedId;
  const { label, error, hint, className = '', ...inputProps } = props;
  return <Field {...{ id, label, error, hint }} required={props.required}><div className="number-unit"><input {...inputProps} id={id} type="number" className={`control ${className}`} aria-invalid={!!error} aria-describedby={[describedBy(id, hint, error), `${id}-unit`].filter(Boolean).join(' ')} /><span id={`${id}-unit`}>{unit}</span></div></Field>;
}
export function Select({ label, error, hint, id: suppliedId, children, ...props }: FieldProps & SelectHTMLAttributes<HTMLSelectElement>) {
  const generatedId = useId(); const id = suppliedId ?? generatedId;
  return <Field {...{ id, label, error, hint }} required={props.required}><select className="control" id={id} aria-invalid={!!error} aria-describedby={describedBy(id, hint, error)} {...props}>{children}</select></Field>;
}
export function TextArea({ label, error, hint, id: suppliedId, ...props }: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement> & { ref?: Ref<HTMLTextAreaElement> }) {
  const generatedId = useId(); const id = suppliedId ?? generatedId;
  return <Field {...{ id, label, error, hint }} required={props.required}><textarea className="control" id={id} aria-invalid={!!error} aria-describedby={describedBy(id, hint, error)} {...props} /></Field>;
}
export function RadioChips({ label, options, value, onChange }: { label: string; options: { value: string; label: string }[]; value: string; onChange: (value: string) => void }) {
  const name = useId();
  return <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}><legend className="field-label">{label}</legend><div className="chips">{options.map(option => <label className="chip" key={option.value}><input type="radio" name={name} value={option.value} checked={value === option.value} onChange={() => onChange(option.value)} />{option.label}</label>)}</div></fieldset>;
}
export function validateFile(file: File, allowedTypes: string[], maxBytes: number): string | undefined {
  if (!allowedTypes.includes(file.type)) return 'Định dạng file không được hỗ trợ.';
  if (file.size > maxBytes) return `File vượt quá ${maxBytes / 1024 / 1024} MB.`;
}
export function FileUpload({ label, onFile, allowedTypes = ['image/jpeg', 'image/png', 'image/webp'], maxBytes = 5 * 1024 * 1024 }: { label: string; onFile: (file: File | null) => void; allowedTypes?: string[]; maxBytes?: number }) {
  const [error, setError] = useState<string>();
  return <TextField label={label} type="file" accept={allowedTypes.join(',')} error={error} hint={`Chỉ chọn file local; chưa upload. ${allowedTypes.map(type => type.replace('image/', '').toUpperCase()).join(', ')} tối đa ${maxBytes / 1024 / 1024} MB.`} onChange={event => {
    const file = event.currentTarget.files?.[0]; const nextError = file ? validateFile(file, allowedTypes, maxBytes) : undefined;
    setError(nextError); onFile(nextError ? null : file ?? null);
    if (nextError) event.currentTarget.value = '';
  }} />;
}
