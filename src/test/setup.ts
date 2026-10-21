import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(cleanup);

// jsdom does not implement pointer capture used by Sonner's swipe handling.
if (typeof Element !== 'undefined') {
for (const method of ['setPointerCapture','releasePointerCapture']) {
  if (!(method in Element.prototype)) Object.defineProperty(Element.prototype,method,{value:()=>{},configurable:true});
}
if (!('hasPointerCapture' in Element.prototype)) Object.defineProperty(Element.prototype,'hasPointerCapture',{value:()=>false,configurable:true});

}
