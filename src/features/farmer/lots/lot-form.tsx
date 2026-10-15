import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Card, FormLayout, PhotoPlaceholder } from '../../../components/shared';
import { Button, DateInput, Select, TextArea, TextField } from '../../../components/ui';
import { formatDate } from '../../../lib/formatters';
import { catalogErrors, formatQuantity, lotToForm, parseLotForm, parseQuantity, tradeMethods,
  type Lot, type LotCatalog, type LotErrors, type LotFormValues, type LotInput } from './lot.model';

export function LotForm({ initialLot, catalog, disabled = false, priceFloor, onSave, imagePicker }: {
  initialLot: Lot | null; catalog: LotCatalog; disabled?: boolean; priceFloor: number | null;
  onSave: (input: LotInput, intent: 'save' | 'publish') => Promise<Lot>;
  imagePicker?: ReactNode;
}) {
  const [values, setValues] = useState(() => lotToForm(initialLot));
  const [errors, setErrors] = useState<LotErrors>({});
  const [feedback, setFeedback] = useState<{ error: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  function change<K extends keyof LotFormValues>(key: K, value: LotFormValues[K]) {
    setValues(current => ({ ...current, [key]: value, ...(key === 'fruit_type_id' ? { variety_id: '' } : {}) }));
    setErrors(current => ({ ...current, [key]: undefined })); setFeedback(null);
  }
  function changeUnit(unit: LotFormValues['unit']) {
    const kg = parseQuantity(values.quantity, values.unit);
    setValues(current => ({ ...current, unit, quantity: kg === null ? current.quantity : formatQuantity(kg, unit) }));
    setFeedback(null);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current || disabled) return;
    const result = parseLotForm(values);
    const nextErrors = result.errors ?? catalogErrors(result.data, catalog, initialLot ?? undefined);
    if (result.data && priceFloor !== null && result.data.price_vnd_per_kg < priceFloor) {
      nextErrors.price_vnd_per_kg = 'Hãy lưu giá sàn thấp hơn hoặc bỏ giá sàn trước khi giảm giá chào.';
    }
    setErrors(nextErrors); setFeedback(null);
    if (!result.data || Object.keys(nextErrors).length) return;
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const intent = submitter?.value === 'publish' ? 'publish' : 'save';
    busy.current = true; setSaving(true);
    try {
      const lot = await onSave(result.data, intent);
      setFeedback({ error: false, text: lot.status === 'PUBLISHED' ? 'Đã lưu lô đã đăng.' : lot.status === 'DRAFT' ? 'Đã lưu lô nháp.' : 'Đã lưu nội dung lô.' });
    } catch (error) { setFeedback({ error: true, text: error instanceof Error ? error.message : 'Chưa lưu được lô. Vui lòng thử lại.' }); }
    finally { busy.current = false; setSaving(false); }
  }
  const fruitName = catalog.fruits.find(item => item.id === values.fruit_type_id)?.name;
  const varietyName = catalog.varieties.find(item => item.id === values.variety_id)?.name;
  return <FormLayout preview={<Card title="Xem trước nội dung công khai"><div className="stack-sm">
    <PhotoPlaceholder alt="Ảnh lô hàng chưa được tải lên" />
    <p>Ảnh đã chọn được lưu sau khi có lô nháp.</p>
    <h3>{values.title || 'Tên lô hàng'}</h3><p>{fruitName} {varietyName}</p>
    <p>{values.quantity || '—'} {values.unit === 'tonne' ? 'tấn' : 'kg'} · {values.price_vnd_per_kg || '—'} đ/kg</p>
    <p>{values.province} {values.district}</p><p>{formatDate(values.harvest_start)} – {formatDate(values.harvest_end)}</p>
    <p>{values.grade}</p><p>{tradeMethods[values.selling_method as keyof typeof tradeMethods]}</p>
    <p>{values.description}</p><p>{values.certifications}</p><p>{values.packaging_options}</p><p>{values.growing_area_code}</p>
    <p className="muted">Chứng nhận tự khai báo, chưa được xác minh. Nội dung trên sẽ công khai khi đăng.</p>
  </div></Card>}><form aria-label="Thông tin lô hàng" className="stack" noValidate onSubmit={submit}>
    <fieldset className="stack" disabled={disabled || saving} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
      {imagePicker}
      <Card title="Thông tin lô"><div className="stack-sm">
        <TextField label="Tên lô hàng" required value={values.title} error={errors.title} onChange={event => change('title', event.target.value)} />
        <Select label="Loại quả" required value={values.fruit_type_id} error={errors.fruit_type_id} onChange={event => change('fruit_type_id', event.target.value)}>
          <option value="">Chọn loại quả</option>{catalog.fruits.filter(item => item.active || item.id === initialLot?.fruit_type_id).map(item => <option key={item.id} value={item.id} disabled={!item.active}>{item.name}{!item.active && ' (ngừng sử dụng)'}</option>)}
        </Select>
        <Select label="Giống" value={values.variety_id} error={errors.variety_id} onChange={event => change('variety_id', event.target.value)}>
          <option value="">Không chọn giống</option>{catalog.varieties.filter(item => item.fruit_type_id === values.fruit_type_id && (item.active || item.id === initialLot?.variety_id)).map(item => <option key={item.id} value={item.id} disabled={!item.active}>{item.name}{!item.active && ' (ngừng sử dụng)'}</option>)}
        </Select>
        <TextField label="Phân loại chất lượng" value={values.grade} error={errors.grade} onChange={event => change('grade', event.target.value)} />
        <TextField label="Khối lượng" required inputMode="decimal" value={values.quantity} error={errors.quantity} onChange={event => change('quantity', event.target.value)} />
        <Select label="Đơn vị khối lượng" value={values.unit} onChange={event => changeUnit(event.target.value as LotFormValues['unit'])}><option value="tonne">Tấn</option><option value="kg">Kg</option></Select>
        <TextField label="Giá chào (đ/kg)" required inputMode="numeric" value={values.price_vnd_per_kg} error={errors.price_vnd_per_kg} onChange={event => change('price_vnd_per_kg', event.target.value)} />
        <DateInput label="Bắt đầu thu hoạch" required value={values.harvest_start} error={errors.harvest_start} onChange={event => change('harvest_start', event.target.value)} />
        <DateInput label="Kết thúc thu hoạch" required value={values.harvest_end} error={errors.harvest_end} onChange={event => change('harvest_end', event.target.value)} />
        <Select label="Phương thức bán" value={values.selling_method} error={errors.selling_method} onChange={event => change('selling_method', event.target.value)}>{Object.entries(tradeMethods).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Select>
      </div></Card>
      <Card title="Vùng trồng và mô tả"><div className="stack-sm">
        {([['province', 'Tỉnh / thành phố'], ['district', 'Quận / huyện'], ['growing_area_code', 'Mã vùng trồng']] as const).map(([key, label]) => <TextField key={key} label={label} required={key === 'province'} value={values[key]} error={errors[key]} onChange={event => change(key, event.target.value)} />)}
        {([['certifications', 'Chứng nhận tự khai báo'], ['packaging_options', 'Đóng gói']] as const).map(([key, label]) => <TextArea key={key} label={label} hint="Mỗi dòng một mục; tối đa 32 mục, mỗi mục 120 ký tự." value={values[key]} error={errors[key]} onChange={event => change(key, event.target.value)} />)}
        <TextArea label="Mô tả công khai" value={values.description} error={errors.description} onChange={event => change('description', event.target.value)} />
      </div></Card>
      <div className="row"><Button type="submit" value="save" variant="secondary" loading={saving}>{!initialLot || initialLot.status === 'DRAFT' ? 'Lưu nháp' : 'Lưu nội dung'}</Button>
        {(!initialLot || initialLot.status === 'DRAFT') && <Button type="submit" value="publish" loading={saving}>Đăng lô hàng</Button>}</div>
    </fieldset>
    {Object.keys(errors).length > 0 && <p role="alert">Vui lòng kiểm tra các trường có lỗi. Lưu nháp cũng cần đủ thông tin hợp lệ.</p>}
    {feedback && <p role={feedback.error ? 'alert' : 'status'}>{feedback.text}</p>}
  </form></FormLayout>;
}
