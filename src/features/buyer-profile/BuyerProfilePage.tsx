import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { getBuyerProfile, saveBuyerProfile, saveDisplayName } from './api';
import { explainError } from '../../lib/format';
import { TextField } from '../../components/ui/fields';
import { Button } from '../../components/ui/button';
import { PageHeader } from '../../components/shared/content';

export function BuyerProfilePage() {
  const { session, profile, retry } = useAuth();
  const [values, setValues] = useState({ full_name: '', organization_name: '', province: '', address: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    let active = true;
    if (!session) return;
    getBuyerProfile(session.user.id).then(data => {
      if (!active) return;
      setValues({ full_name: profile?.full_name ?? '', organization_name: data?.organization_name ?? '',
        province: data?.province ?? '', address: data?.address ?? '' }); setLoading(false);
    }).catch(cause => { if (active) { setError(explainError(cause)); setLoading(false); } });
    return () => { active = false; };
  }, [session?.user.id, profile?.full_name]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!session) return;
    const fullName = values.full_name.trim();
    const organization = values.organization_name.trim();
    const province = values.province.trim();
    if (!fullName || !organization || !province) { setError('Nhập tên, tổ chức và tỉnh.'); return; }
    setSaving(true); setError(''); setNotice('');
    try {
      await saveBuyerProfile(session.user.id, { organization_name: organization, province,
        address: values.address.trim() || null });
      setNotice('Đã lưu hồ sơ tổ chức.');
      await saveDisplayName(session.user.id, fullName);
      setNotice('Đã lưu hồ sơ tổ chức và tên hiển thị.');
      retry();
    } catch (cause) { setError(`${explainError(cause)} Hồ sơ tổ chức có thể đã được lưu; kiểm tra trước khi thử lại.`); }
    finally { setSaving(false); }
  }

  return <><PageHeader eyebrow="Tài khoản" title="Hồ sơ thương lái" description="Thông tin tổ chức và tên hiển thị của bạn." />
    <section className="panel form-panel narrow">{loading ? <p>Đang tải hồ sơ…</p> : <form onSubmit={submit}>
      <div className="form-grid"><TextField label="Tên hiển thị" value={values.full_name} maxLength={160} onChange={e => setValues({ ...values, full_name: e.target.value })} required />
        <TextField label="Tên tổ chức" value={values.organization_name} maxLength={160} onChange={e => setValues({ ...values, organization_name: e.target.value })} required />
        <TextField label="Tỉnh / thành phố" value={values.province} maxLength={120} onChange={e => setValues({ ...values, province: e.target.value })} required />
        <TextField label="Địa chỉ riêng" value={values.address} maxLength={500} onChange={e => setValues({ ...values, address: e.target.value })} /></div>
      {error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="form-success" role="status">{notice}</p>}
      <Button type="submit" loading={saving}>{saving ? 'Đang lưu…' : 'Lưu hồ sơ'}</Button>
    </form>}</section></>;
}
