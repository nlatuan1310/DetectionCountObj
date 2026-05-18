import React from 'react';
import { Layers, Clock, Play, Trash2, Eye, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '../../utils/cn';

const STATUS_CONFIG = {
  draft: { label: 'Bản nháp', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  generating: { label: 'Đang xử lý', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  generated: { label: 'Đã sinh', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  failed: { label: 'Lỗi', color: 'text-red-400 bg-red-500/10 border-red-500/20' },
};

const SplitBar = ({ train = 0, val = 0, test = 0 }) => {
  const total = train + val + test;
  if (total === 0) return null;

  const pTrain = (train / total) * 100;
  const pVal = (val / total) * 100;
  const pTest = (test / total) * 100;

  return (
    <div className="space-y-1.5">
      <div className="flex h-2 rounded-full overflow-hidden bg-slate-700/50">
        <div className="bg-blue-500 transition-all duration-500" style={{ width: `${pTrain}%` }} />
        <div className="bg-amber-500 transition-all duration-500" style={{ width: `${pVal}%` }} />
        <div className="bg-emerald-500 transition-all duration-500" style={{ width: `${pTest}%` }} />
      </div>
      <div className="flex gap-3 text-[10px]">
        <span className="text-blue-400">Train: {train}</span>
        <span className="text-amber-400">Val: {val}</span>
        <span className="text-emerald-400">Test: {test}</span>
      </div>
    </div>
  );
};

const VersionCard = ({
  version,
  onGenerate,
  onViewDetail,
  onDelete,
  isGenerating = false,
}) => {
  const statusConfig = STATUS_CONFIG[version.status] || STATUS_CONFIG.draft;

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleString('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <div
      className={cn(
        'bg-slate-800/40 backdrop-blur-md border border-slate-700/50 rounded-2xl p-5',
        'hover:border-slate-600/50 transition-all duration-200'
      )}
    >
      {/* Top row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn(
            'p-2 rounded-lg',
            version.status === 'generated' ? 'bg-emerald-500/10' : 'bg-blue-500/10'
          )}>
            <Layers size={18} className={
              version.status === 'generated' ? 'text-emerald-400' : 'text-blue-400'
            } />
          </div>
          <div>
            <h4 className="font-semibold text-slate-200">
              {version.version_name || `Version ${version.id}`}
            </h4>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
              <Clock size={12} />
              {formatDate(version.created_at)}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={cn(
              'px-3 py-1 text-xs font-semibold rounded-full border',
              statusConfig.color
            )}
          >
            {version.status === 'generating' && (
              <Loader2 size={10} className="inline animate-spin mr-1" />
            )}
            {version.status === 'failed' && (
              <AlertCircle size={10} className="inline mr-1" />
            )}
            {statusConfig.label}
          </span>
        </div>
      </div>

      {/* Split bar (chỉ hiện khi generated) */}
      {version.status === 'generated' && version.total_images > 0 && (
        <div className="mt-4">
          <SplitBar
            train={version.train_count}
            val={version.val_count}
            test={version.test_count}
          />
          <div className="mt-1.5 text-[11px] text-slate-500">
            Tổng: {version.total_images} ảnh · Ratio: {version.split_ratio}
          </div>
        </div>
      )}

      {/* Augmentation tags */}
      {version.augmentation_config && Object.keys(version.augmentation_config).length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {Object.entries(version.augmentation_config)
            .filter(([, val]) => val === true)
            .map(([key]) => (
              <span
                key={key}
                className="px-2 py-0.5 text-[10px] rounded-full bg-slate-700/50 text-slate-300 border border-slate-600/30"
              >
                {key.replace(/_/g, ' ')}
              </span>
            ))}
          {version.augmentation_config.multiplier && (
            <span className="px-2 py-0.5 text-[10px] rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
              {version.augmentation_config.multiplier}x
            </span>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="mt-4 flex items-center gap-2 pt-3 border-t border-slate-700/30">
        {(version.status === 'draft' || version.status === 'failed') && (
          <button
            onClick={() => onGenerate(version)}
            disabled={isGenerating}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg',
              'bg-blue-500/10 text-blue-400 border border-blue-500/20',
              'hover:bg-blue-500/20 transition-all duration-200',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {isGenerating ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Play size={12} />
            )}
            {isGenerating ? 'Đang xử lý...' : 'Generate'}
          </button>
        )}

        {version.status === 'generated' && (
          <button
            onClick={() => onViewDetail(version)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg',
              'bg-slate-700/50 text-slate-300 border border-slate-600/30',
              'hover:bg-slate-700 transition-all duration-200'
            )}
          >
            <Eye size={12} />
            Chi tiết
          </button>
        )}

        <button
          onClick={() => onDelete(version)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg ml-auto',
            'text-red-400/60 hover:text-red-400 hover:bg-red-500/10',
            'border border-transparent hover:border-red-500/20',
            'transition-all duration-200'
          )}
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
};

export default VersionCard;
