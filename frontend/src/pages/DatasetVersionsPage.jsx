import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Layers, Loader2 } from 'lucide-react';
import { cn } from '../utils/cn';
import AugmentationConfigForm from '../components/Dataset/AugmentationConfigForm';
import VersionCard from '../components/Dataset/VersionCard';
import VersionDetailModal from '../components/Dataset/VersionDetailModal';
import { getProject } from '../services/project_service';
import {
  listVersions,
  createVersion,
  generateVersion,
  deleteVersion,
} from '../services/dataset_version_service';

const DatasetVersionsPage = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [versions, setVersions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [generatingId, setGeneratingId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Detail modal state
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailVersionId, setDetailVersionId] = useState(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [projectData, versionsData] = await Promise.all([
        getProject(projectId),
        listVersions(projectId),
      ]);
      setProject(projectData);
      setVersions(versionsData);
    } catch (err) {
      setError('Không thể tải dữ liệu');
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateVersion = async ({ version_name, augmentation_config }) => {
    try {
      setError(null);
      await createVersion(projectId, { version_name, augmentation_config });
      setShowCreate(false);
      await fetchData();
    } catch (err) {
      setError('Tạo version thất bại');
    }
  };

  const handleGenerate = async (version) => {
    setGeneratingId(version.id);
    setError(null);
    try {
      await generateVersion(projectId, version.id);
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Generate thất bại');
      await fetchData();
    } finally {
      setGeneratingId(null);
    }
  };

  const handleViewDetail = (version) => {
    setDetailVersionId(version.id);
    setDetailModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      setError(null);
      await deleteVersion(projectId, deleteConfirm.id);
      setDeleteConfirm(null);
      await fetchData();
    } catch (err) {
      setError('Xóa version thất bại');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={24} className="animate-spin text-blue-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/projects/${projectId}`)}
            className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Dataset Versions</h2>
            <p className="text-sm text-slate-400 mt-0.5">{project?.name}</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className={cn(
            'px-4 py-2.5 text-sm font-medium rounded-xl transition-all duration-200',
            showCreate
              ? 'bg-slate-800 text-slate-400'
              : 'bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20'
          )}
        >
          {showCreate ? 'Hủy' : '+ Tạo Version'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="bg-slate-800/40 backdrop-blur-md border border-slate-700/50 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-slate-200 mb-4">Tạo Version Mới</h3>
          <AugmentationConfigForm onSubmit={handleCreateVersion} projectId={projectId} />
        </div>
      )}

      {/* Versions list */}
      {versions.length > 0 ? (
        <div className="space-y-3">
          {versions.map((ver) => (
            <VersionCard
              key={ver.id}
              version={ver}
              onGenerate={handleGenerate}
              onViewDetail={handleViewDetail}
              onDelete={(v) => setDeleteConfirm(v)}
              isGenerating={generatingId === ver.id}
            />
          ))}
        </div>
      ) : (
        !showCreate && (
          <div className="flex flex-col items-center justify-center py-16 text-slate-500">
            <Layers size={48} className="mb-3 text-slate-600" />
            <p className="text-sm">Chưa có version nào</p>
            <p className="text-xs text-slate-600 mt-1">
              Tạo version mới để cấu hình Augmentation và sinh dataset
            </p>
          </div>
        )
      )}

      {/* Detail Modal */}
      <VersionDetailModal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        projectId={parseInt(projectId)}
        versionId={detailVersionId}
      />

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setDeleteConfirm(null)}
          />
          <div className="relative bg-slate-900/95 border border-slate-700/50 rounded-2xl p-6 max-w-md mx-4 space-y-4">
            <h3 className="text-lg font-semibold text-white">Xóa Version?</h3>
            <p className="text-sm text-slate-400">
              Xóa <strong>{deleteConfirm.version_name || `Version ${deleteConfirm.id}`}</strong> sẽ
              xóa cả thư mục YOLO đã sinh. Không thể hoàn tác.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 text-sm bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 border border-red-500/20 transition-colors"
              >
                Xóa vĩnh viễn
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DatasetVersionsPage;
