import { useRef, useState, type FormEvent } from 'react';
import { Card } from '../../../components/shared';
import { Button, NumberWithUnit, TextArea, TextField } from '../../../components/ui';
import {
  parseProfileForm, profileNumberFields, profileTextFields, profileToForm,
  type FarmerProfileErrors, type FarmerProfileFormValues, type FarmerProfileInput,
} from './farmer-profile.model';

export function FarmerProfileForm({ initialProfile, onSave }: {
  initialProfile: FarmerProfileInput | null;
  onSave: (input: FarmerProfileInput) => Promise<unknown>;
}) {
  const [values, setValues] = useState(() => profileToForm(initialProfile));
  const [errors, setErrors] = useState<FarmerProfileErrors>({});
  const [feedback, setFeedback] = useState<'saved' | 'error' | null>(null);
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);

  function change(name: keyof FarmerProfileFormValues, value: string) {
    setValues(current => ({ ...current, [name]: value }));
    setErrors(current => ({ ...current, [name]: undefined }));
    setFeedback(null);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const result = parseProfileForm(values);
    setErrors(result.errors ?? {});
    setFeedback(null);
    if (!result.data) return;
    submitting.current = true;
    setSaving(true);
    try { await onSave(result.data); setFeedback('saved'); }
    catch { setFeedback('error'); }
    finally { submitting.current = false; setSaving(false); }
  }

  return <form className="stack" aria-label="Hồ sơ nhà vườn" noValidate onSubmit={submit}>
    <fieldset disabled={saving} className="stack" style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
      <Card title="Thông tin vườn"><div className="stack-sm">
        {profileTextFields.map(field => <TextField key={field.name} label={field.label} required={field.required}
          value={values[field.name]} error={errors[field.name]} onChange={event => change(field.name, event.target.value)} />)}
      </div></Card>
      <Card title="Quy mô và vị trí"><div className="stack-sm">
        {profileNumberFields.map(field => <NumberWithUnit key={field.name} label={field.label} unit={field.unit}
          min={field.min} max={field.max} step={10 ** -field.decimals} value={values[field.name]} error={errors[field.name]}
          onChange={event => change(field.name, event.target.value)} />)}
        <p className="muted">Tọa độ tùy chọn: nhập đủ cả vĩ độ và kinh độ hoặc để trống cả hai.</p>
      </div></Card>
      <Card title="Giống cây và chứng nhận"><div className="stack-sm">
        <TextArea label="Giống đang trồng" hint="Mỗi dòng một giống; tối đa 32 mục, mỗi mục 120 ký tự."
          value={values.cultivated_varieties} error={errors.cultivated_varieties} onChange={event => change('cultivated_varieties', event.target.value)} />
        <TextArea label="Chứng nhận tự khai báo" hint="Thông tin tự khai báo, chưa được xác minh. Mỗi dòng một chứng nhận; tối đa 32 mục, mỗi mục 120 ký tự."
          value={values.certifications} error={errors.certifications} onChange={event => change('certifications', event.target.value)} />
      </div></Card>
      <div><Button type="submit" loading={saving}>Lưu hồ sơ</Button></div>
    </fieldset>
    {Object.values(errors).some(Boolean) && <p role="alert">Vui lòng kiểm tra các trường có lỗi.</p>}
    {feedback === 'saved' && <p role="status">Đã lưu hồ sơ nhà vườn.</p>}
    {feedback === 'error' && <p role="alert">Không thể lưu hồ sơ. Thông tin đã nhập được giữ lại; vui lòng thử lưu lại.</p>}
  </form>;
}
