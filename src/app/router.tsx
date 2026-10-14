import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { StartPage } from './start-page';

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<StartPage />} />
        <Route path="*" element={<main>Không tìm thấy trang.</main>} />
      </Routes>
    </BrowserRouter>
  );
}
