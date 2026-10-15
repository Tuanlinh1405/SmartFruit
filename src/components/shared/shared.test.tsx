import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { DataTable, sortRows, type Column } from './data-table';
import { ErrorState, LoadingState, PhotoPlaceholder } from './content';
const rows=[{id:'a',name:'A',quantity:20},{id:'b',name:'B',quantity:3}];
const columns:Column<typeof rows[number]>[]=[{id:'name',label:'Tên',render:row=>row.name,sortValue:row=>row.name},{id:'quantity',label:'Lượng',render:row=>row.quantity,sortValue:row=>row.quantity}];
test('sorts numbers numerically without mutating input',()=>{expect(sortRows(rows,columns[1]).map(row=>row.id)).toEqual(['b','a']);expect(sortRows(rows,columns[1],'desc').map(row=>row.id)).toEqual(['a','b']);expect(rows[0].id).toBe('a');});
test('table exposes accessible sort direction',async()=>{render(<DataTable rows={rows} columns={columns} rowKey={row=>row.id} caption="Bảng"/>);await userEvent.click(screen.getByRole('button',{name:/^Lượng$/}));expect(screen.getByRole('columnheader',{name:'Lượng'})).toHaveAttribute('aria-sort','ascending');await userEvent.click(screen.getByRole('button',{name:/^Lượng$/}));expect(screen.getByRole('columnheader',{name:'Lượng'})).toHaveAttribute('aria-sort','descending');});
test('table empty state replaces rows',()=>{render(<DataTable rows={[]} columns={columns} rowKey={row=>row.id} caption="Bảng"/>);expect(screen.getByText('Không tìm thấy kết quả')).toBeVisible();expect(screen.queryByRole('table')).not.toBeInTheDocument();});
test('loading and retry have accessible feedback',async()=>{const retry=vi.fn();render(<><LoadingState/><ErrorState onRetry={retry}/></>);expect(screen.getByRole('status')).toHaveTextContent('Đang tải');await userEvent.click(screen.getByRole('button',{name:'Thử lại'}));expect(retry).toHaveBeenCalledOnce();});
test('broken photo falls back without losing description',()=>{render(<PhotoPlaceholder src="/broken" alt="Sầu riêng"/>);fireEvent.error(screen.getByRole('img'));expect(screen.getByText('Sầu riêng')).toBeVisible();expect(screen.getByRole('img')).toHaveAccessibleName('Sầu riêng');});

