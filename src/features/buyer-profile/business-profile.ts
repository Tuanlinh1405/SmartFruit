export const businessFields = ['full_name','organization_name','province','address','business_phone','business_email','tax_code','business_license','representative_name','production_certificate'] as const;
export type BusinessProfile = Record<typeof businessFields[number],string>;
export const emptyBusinessProfile = Object.fromEntries(businessFields.map(k=>[k,''])) as BusinessProfile;
export interface Evidence { path:string;label:string;url?:string;file?:File }
export function normalizePhone(value:string) {
  const digits=value.replace(/[\s().-]/g,'');
  return /^0\d{9}$/.test(digits)?`+84${digits.slice(1)}`:/^84\d{9}$/.test(digits)?`+${digits}`:digits;
}
export function validateBusinessProfile(input:BusinessProfile,attested:boolean) {
  const data=Object.fromEntries(businessFields.map(k=>[k,input[k].trim()])) as BusinessProfile;
  data.business_phone=normalizePhone(data.business_phone);
  const errors:Partial<Record<keyof BusinessProfile|'attested',string>>={};
  for(const k of ['full_name','organization_name','province','business_license','representative_name'] as const)if(!data[k]||data[k].length>160)errors[k]='Nhập thông tin hợp lệ (tối đa 160 ký tự).';
  if(data.province.length>120)errors.province='Tối đa 120 ký tự.';
  if(!/^\+84\d{9}$/.test(data.business_phone))errors.business_phone='Nhập số điện thoại Việt Nam 10 chữ số hoặc +84.';
  if(!/^(\d{10}|\d{13})$/.test(data.tax_code))errors.tax_code='Mã số thuế gồm 10 hoặc 13 chữ số.';
  if(data.business_email&&(data.business_email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.business_email)))errors.business_email='Email không hợp lệ.';
  if(data.address.length>500)errors.address='Địa chỉ tối đa 500 ký tự.';
  if(data.production_certificate.length>200)errors.production_certificate='Tối đa 200 ký tự.';
  if(!attested)errors.attested='Vui lòng xác nhận thông tin trước khi lưu.';
  return {data,errors};
}
export function evidenceError(files:File[],existing:number) {
  if(files.length+existing>10)return 'Chỉ được lưu tối đa 10 ảnh.';
  if(files.some(f=>!['image/jpeg','image/png'].includes(f.type)))return 'Chỉ hỗ trợ ảnh JPG và PNG.';
  if(files.some(f=>f.size>5*1024*1024))return 'Mỗi ảnh tối đa 5 MB.';
}
