import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Layers, Clock, Loader2 } from 'lucide-react';
import { cn } from '../utils/cn';
import AugmentationConfigForm from '../components/Dataset/AugmentationConfigForm';
import { getProject } from '../services/project_service';
import apiClient from '../services/apiClient';

const DatasetVersionsPage = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [versions, setVersions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreate, setShowCreate] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [projectData, versionsRes] = await Promise.all([
        getProject(projectId),
        apiClient.get(`/projects/${projectId}/versions`),
      ]);
      setProject(projectData);
      setVersions(versionsRes.data);
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
      await apiClient.post(`/projects/${projectId}/versions`, {
        version_name,
        augmentation_config,
      });
      setShowCreate(false);
      await fetchData();
    } catch (err) {
      setError('Tạo version thất bại');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleString('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const statusColors = {
    draft: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    generated: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
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
          <AugmentationConfigForm onSubmit={handleCreateVersion} />
        </div>
      )}

      {/* Versions list */}
      {versions.length > 0 ? (
        <div className="space-y-3">
          {versions.map((ver) => (
            <div
              key={ver.id}
              className={cn(
                'bg-slate-800/40 backdrop-blur-md border border-slate-700/50 rounded-2xl p-5',
                'hover:border-slate-600/50 transition-all duration-200'
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <Layers size={18} className="text-blue-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-200">
                      {ver.version_name || `Version ${ver.id}`}
                    </h4>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                      <Clock size={12} />
                      {formatDate(ver.created_at)}
                    </div>
                  </div>
                </div>

                <span
                  className={cn(
                    'px-3 py-1 text-xs font-semibold rounded-full border',
                    statusColors[ver.status] || statusColors.draft
                  )}
                >
                  {ver.status === 'draft' ? 'Bản nháp' : 'Đã sinh'}
                </span>
              </div>

              {/* Augmentation config summary */}
              {ver.augmentation_config && Object.keys(ver.augmentation_config).length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {Object.entries(ver.augmentation_config)
                    .filter(([key, val]) => val === true)
                    .map(([key]) => (
                      <span
                        key={key}
                        className="px-2 py-0.5 text-[10px] rounded-full bg-slate-700/50 text-slate-300 border border-slate-600/30"
                      >
                        {key.replace(/_/g, ' ')}
                      </span>
                    ))}
                  {ver.augmentation_config.multiplier && (
                    <span className="px-2 py-0.5 text-[10px] rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      {ver.augmentation_config.multiplier}x
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        !showCreate && (
          <div className="flex flex-col items-center justify-center py-16 text-slate-500">
            <Layers size={48} className="mb-3 text-slate-600" />
            <p className="text-sm">Chưa có version nào</p>
            <p className="text-xs text-slate-600 mt-1">
              Tạo version mới để cấu hình Augmentation
            </p>
          </div>
        )
      )}
    </div>
  );
};

export default DatasetVersionsPage;
