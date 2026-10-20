export const brandName = 'ONLMALLFRUIT';

export function Brand({ tagline = false }: { tagline?: boolean }) {
  return <><img className="brand-logo" src={`${import.meta.env.BASE_URL}onlmallfruit-logo.jpg`} width={436} height={442} alt="" /><span className="brand-name">{brandName}{tagline && <small>Nông sản Việt Nam</small>}</span></>;
}
