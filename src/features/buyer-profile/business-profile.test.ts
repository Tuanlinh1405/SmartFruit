import {expect,test} from 'vitest';
import {emptyBusinessProfile,evidenceError,normalizePhone,validateBusinessProfile} from './business-profile';
const valid={...emptyBusinessProfile,full_name:'An',organization_name:'An Phú',province:'Đồng Nai',business_phone:'0903 123 456',tax_code:'1234567890',business_license:'GP-123',representative_name:'An'};
test('business contact validation normalizes Vietnamese phone and requires attestation',()=>{
 expect(normalizePhone('0903 123 456')).toBe('+84903123456');
 expect(normalizePhone('84 903 123 456')).toBe('+84903123456');
 expect(validateBusinessProfile(valid,true)).toEqual({data:{...valid,business_phone:'+84903123456'},errors:{}});
 expect(validateBusinessProfile(valid,false).errors.attested).toBeTruthy();
 expect(validateBusinessProfile({...valid,tax_code:'abc',business_email:'bad',business_phone:'123'},true).errors).toMatchObject({tax_code:expect.any(String),business_email:expect.any(String),business_phone:expect.any(String)});
 expect(validateBusinessProfile({...valid,tax_code:'1234567890123'},true).errors).toEqual({});
});
test('evidence limits count, file type and size before upload',()=>{
 const png=new File(['image'],'proof.png',{type:'image/png'});
 expect(evidenceError([png],9)).toBeUndefined();expect(evidenceError([png],10)).toContain('10');
 expect(evidenceError([new File(['x'],'file.svg',{type:'image/svg+xml'})],0)).toContain('JPG');
 expect(evidenceError([new File([new Uint8Array(5*1024*1024+1)],'large.png',{type:'image/png'})],0)).toContain('5 MB');
});
