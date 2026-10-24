import {fireEvent,render,screen} from '@testing-library/react';
import {expect,test,vi} from 'vitest';
import {ProductPhoto} from './product-photo';
test.each([true,false])('photo provenance remains accurate for generated=%s',is_ai_generated=>{
 render(<ProductPhoto photo={{url:'https://example.test/photo.jpg',is_ai_generated}} alt="Sầu riêng Ri6"/>);
 expect(screen.getByRole('img',{name:'Sầu riêng Ri6'})).toHaveAttribute('src','https://example.test/photo.jpg');
 expect(!!screen.queryByText('Ảnh minh họa AI')).toBe(is_ai_generated);
});
test('expired or failed images offer retry and recover when a fresh signed URL arrives',()=>{
 const retry=vi.fn();const view=render(<ProductPhoto photo={{url:'https://example.test/old.jpg',is_ai_generated:true}} alt="Ri6" onRetry={retry}/>);
 fireEvent.error(screen.getByRole('img'));fireEvent.click(screen.getByRole('button',{name:'Tải lại ảnh'}));expect(retry).toHaveBeenCalledOnce();
 view.rerender(<ProductPhoto photo={{url:'https://example.test/new.jpg',is_ai_generated:true}} alt="Ri6" onRetry={retry}/>);
 expect(screen.getByRole('img',{name:'Ri6'})).toHaveAttribute('src','https://example.test/new.jpg');
});
