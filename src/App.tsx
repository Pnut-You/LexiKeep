import { lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import { ThemeProvider } from './components/ThemeProvider';

const FilesPage = lazy(() => import('./pages/FilesPage'));
const WordsPage = lazy(() => import('./pages/WordsPage'));
const PhrasesPage = lazy(() => import('./pages/PhrasesPage'));
const ReadingPage = lazy(() => import('./pages/ReadingPage'));
const ReviewPage = lazy(() => import('./pages/ReviewPage'));
const InsightsPage = lazy(() => import('./pages/InsightsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Navigate to="/files" replace />} />
            <Route path="/files" element={<FilesPage />} />
            <Route path="/words" element={<WordsPage />} />
            <Route path="/phrases" element={<PhrasesPage />} />
            <Route path="/reading" element={<ReadingPage />} />
            <Route path="/review" element={<ReviewPage />} />
            <Route path="/insights" element={<InsightsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
