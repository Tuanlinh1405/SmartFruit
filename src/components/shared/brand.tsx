import { BrandMark } from '../brand-mark';
export const brandName = 'onlmallfruit';
export function Brand({tagline=false}:{tagline?:boolean}) {
  return <><BrandMark /><span className="brand-name">{brandName}{tagline && <small>Nông sản Việt Nam</small>}</span></>;
}
