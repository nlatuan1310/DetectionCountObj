import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import DashboardLayout from './layouts/DashboardLayout';

// Lazy load pages
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const StreamPage = lazy(() => import('./pages/StreamPage'));
const ProductsPage = lazy(() => import('./pages/ProductsPage'));
const ProjectsPage = lazy(() => import('./pages/ProjectsPage'));
const ProjectDetailPage = lazy(() => import('./pages/ProjectDetailPage'));
const AnnotationPage = lazy(() => import('./pages/AnnotationPage'));
const DatasetVersionsPage = lazy(() => import('./pages/DatasetVersionsPage'));

const PageLoader = () => (
  <div className="flex items-center justify-center h-full">
    <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
  </div>
);

const SettingsPage = () => <div className="p-6">Settings Placeholder</div>;

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<DashboardLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="stream" element={<StreamPage />} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="projects" element={<ProjectsPage />} />
            <Route path="projects/:projectId" element={<ProjectDetailPage />} />
            <Route path="projects/:projectId/annotate/:imageId" element={<AnnotationPage />} />
            <Route path="projects/:projectId/versions" element={<DatasetVersionsPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
