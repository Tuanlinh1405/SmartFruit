import { useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { EmptyState } from './content';
import { TextField } from '../ui/fields';
export interface Column<T> { id: string; label: string; render: (row: T) => ReactNode; sortValue?: (row: T) => string | number; }
export function sortRows<T>(rows: T[], column?: Column<T>, direction: 'asc' | 'desc' = 'asc') {
  if (!column?.sortValue) return rows;
  const value = column.sortValue;
  return [...rows].sort((a, b) => { const av = value(a); const bv = value(b); const result = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv), 'vi'); return direction === 'asc' ? result : -result; });
}
export function FilterBar({ search, onSearch, children }: { search: string; onSearch: (value: string) => void; children?: ReactNode }) { return <div className="filter-bar"><TextField label="Tìm kiếm" type="search" placeholder="Nhập từ khóa…" value={search} onChange={event => onSearch(event.target.value)} />{children}</div>; }
export function DataTable<T>({ rows, columns, rowKey, caption }: { rows: T[]; columns: Column<T>[]; rowKey: (row: T) => string; caption: string }) {
  const [sort, setSort] = useState<{ id: string; direction: 'asc' | 'desc' }>();
  const sorted = sortRows(rows, columns.find(column => column.id === sort?.id), sort?.direction);
  const toggle = (id: string) => setSort(current => ({ id, direction: current?.id === id && current.direction === 'asc' ? 'desc' : 'asc' }));
  if (!rows.length) return <EmptyState title="Không tìm thấy kết quả" description="Thử thay đổi từ khóa hoặc bộ lọc." />;
  return <><div className="table-wrap"><table><caption className="sr-only">{caption}</caption><thead><tr>{columns.map(column => <th key={column.id} aria-sort={column.sortValue ? sort?.id === column.id ? sort.direction === 'asc' ? 'ascending' : 'descending' : 'none' : undefined}>{column.sortValue ? <button type="button" onClick={() => toggle(column.id)}>{column.label}{sort?.id === column.id ? sort.direction === 'asc' ? <ArrowUp size={16} aria-hidden="true" /> : <ArrowDown size={16} aria-hidden="true" /> : <ArrowUpDown size={16} aria-hidden="true" />}</button> : column.label}</th>)}</tr></thead><tbody>{sorted.map(row => <tr key={rowKey(row)}>{columns.map(column => <td key={column.id}>{column.render(row)}</td>)}</tr>)}</tbody></table></div><div className="table-mobile" aria-label={caption}><div className="row">{columns.filter(column => column.sortValue).map(column => <button className="button button-secondary" type="button" key={column.id} onClick={() => toggle(column.id)}>Sắp xếp {column.label}{sort?.id === column.id ? sort.direction === 'asc' ? ' ↑' : ' ↓' : ''}</button>)}</div>{sorted.map(row => <article className="card" key={rowKey(row)}><dl>{columns.map(column => <div key={column.id}><dt>{column.label}</dt><dd>{column.render(row)}</dd></div>)}</dl></article>)}</div></>;
}
