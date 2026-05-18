import React, { useState, useEffect } from 'react';
import { X, Layers, Clock, BarChart3, Loader2, FolderOpen } from 'lucide-react';
import { cn } from '../../utils/cn';
import { getVersionDetail } from '../../services/dataset_version_service';

const VersionDetailModal = ({ isOpen, onClose, projectId, versionId }) => {
  const [detail, setDetail] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen || !versionId) return;

    const fetchDetail = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await getVersionDetail(projectId, versionId);
        setDetail(data);
      } catch (err) {
        setError('Không thể tải chi tiết version');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDetail();
  }, [isOpen, projectId, versionId]);

  if (!isOpen) return null;

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  // Tính max annotation count cho horizontal bar scaling
  const maxCount = detail?.class_distribution?.reduce(
    (max, c) => Math.max(max, c.total), 0
  ) || 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-slate-900/95 border border-slate-700/50 rounded-2xl w-full max-w-2xl mx-4 max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <Layers size={18} className="text-emerald-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">
                {detail?.version_name || 'Chi tiết Version'}
              </h3>
              <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                <Clock size={12} />
                Tạo: {formatDate(detail?.created_at)}
                {detail?.generated_at && (
                  <span className="ml-2">· Sinh: {formatDate(detail?.generated_at)}</span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-blue-400" />
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          {detail && !isLoading && (
            <>
              {/* Stats cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard label="Tổng ảnh" value={detail.total_images} color="text-white" />
                <StatCard label="Train" value={detail.train_count} color="text-blue-400" />
                <StatCard label="Validation" value={detail.val_count} color="text-amber-400" />
                <StatCard label="Test" value={detail.test_count} color="text-emerald-400" />
              </div>

              {/* Extra stats */}
              <div className="grid grid-cols-2 gap-3">
                <StatCard label="Ảnh có nhãn" value={detail.labeled_count} color="text-violet-400" />
                <StatCard label="Ảnh background" value={detail.background_count} color="text-slate-300" />
              </div>

              {/* Split ratio */}
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <span>Split Ratio:</span>
                <span className="font-mono font-semibold text-white">{detail.split_ratio}</span>
              </div>

              {/* Split visual bar */}
              <div className="space-y-1.5">
                <div className="flex h-3 rounded-full overflow-hidden bg-slate-700/50">
                  {detail.total_images > 0 && (
                    <>
                      <div
                        className="bg-blue-500 transition-all duration-500"
                        style={{ width: `${(detail.train_count / detail.total_images) * 100}%` }}
                      />
                      <div
                        className="bg-amber-500 transition-all duration-500"
                        style={{ width: `${(detail.val_count / detail.total_images) * 100}%` }}
                      />
                      <div
                        className="bg-emerald-500 transition-all duration-500"
                        style={{ width: `${(detail.test_count / detail.total_images) * 100}%` }}
                      />
                    </>
                  )}
                </div>
              </div>

              {/* Class Distribution */}
              {detail.class_distribution.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <BarChart3 size={16} className="text-slate-400" />
                    <h4 className="text-sm font-semibold text-slate-200">
                      Phân bổ theo Class ({detail.class_distribution.length} classes)
                    </h4>
                  </div>
                  <div className="space-y-2">
                    {detail.class_distribution.map((cls) => (
                      <div key={cls.class_id} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-300 font-medium">{cls.class_name}</span>
                          <span className="text-slate-500">{cls.total} annotations</span>
                        </div>
                        <div className="flex h-2 rounded-full overflow-hidden bg-slate-700/50">
                          <div
                            className="bg-blue-500/80"
                            style={{ width: `${(cls.train / maxCount) * 100}%` }}
                          />
                          <div
                            className="bg-amber-500/80"
                            style={{ width: `${(cls.val / maxCount) * 100}%` }}
                          />
                          <div
                            className="bg-emerald-500/80"
                            style={{ width: `${(cls.test / maxCount) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-4 mt-2 text-[10px] text-slate-500">
                    <span><span className="inline-block w-2 h-2 rounded-full bg-blue-500 mr-1" />Train</span>
                    <span><span className="inline-block w-2 h-2 rounded-full bg-amber-500 mr-1" />Val</span>
                    <span><span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1" />Test</span>
                  </div>
                </div>
              )}

              {/* YOLO path */}
              {detail.yolo_dataset_path && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-800/60 border border-slate-700/50 text-xs">
                  <FolderOpen size={14} className="text-slate-400 shrink-0" />
                  <span className="text-slate-400">YOLO Output:</span>
                  <code className="text-slate-300 font-mono truncate">{detail.yolo_dataset_path}</code>
                </div>
              )}

              {/* Augmentation config */}
              {detail.augmentation_config && Object.keys(detail.augmentation_config).length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-slate-200 mb-2">Augmentation Config</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(detail.augmentation_config)
                      .filter(([, val]) => val === true)
                      .map(([key]) => (
                        <span
                          key={key}
                          className="px-2 py-0.5 text-[10px] rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20"
                        >
                          {key.replace(/_/g, ' ')}
                        </span>
                      ))}
                    {detail.augmentation_config.multiplier && (
                      <span className="px-2 py-0.5 text-[10px] rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20">
                        ×{detail.augmentation_config.multiplier}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ label, value, color = 'text-white' }) => (
  <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/50">
    <p className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</p>
    <p className={cn('text-xl font-bold mt-0.5', color)}>{value}</p>
  </div>
);

export default VersionDetailModal;
