import React from 'react';
import { Calendar, Image as ImageIcon, Tag } from 'lucide-react';
import { cn } from '../../utils/cn';

const ProjectCard = ({ project, onClick }) => {
  const { name, description, created_at, image_count = 0, annotated_count = 0 } = project;

  const progress = image_count > 0 ? Math.round((annotated_count / image_count) * 100) : 0;

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        'group relative w-full text-left rounded-2xl p-5',
        'bg-slate-800/40 backdrop-blur-md border border-slate-700/50',
        'hover:bg-slate-800/60 hover:border-slate-600/50',
        'hover:shadow-[0_0_30px_rgba(59,130,246,0.08)]',
        'transition-all duration-300 cursor-pointer',
        'focus:outline-none focus:ring-2 focus:ring-blue-500/30'
      )}
    >
      {/* Glow effect on hover */}
      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none bg-gradient-to-br from-blue-500/5 to-emerald-500/5" />

      <div className="relative z-10">
        {/* Header */}
        <h3 className="text-lg font-semibold text-slate-100 group-hover:text-white transition-colors truncate">
          {name}
        </h3>
        {description && (
          <p className="mt-1 text-sm text-slate-400 line-clamp-2">{description}</p>
        )}

        {/* Stats */}
        <div className="mt-4 flex items-center gap-4 text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <ImageIcon size={14} className="text-blue-400" />
            {image_count} ảnh
          </span>
          <span className="flex items-center gap-1.5">
            <Tag size={14} className="text-emerald-400" />
            {annotated_count} gán nhãn
          </span>
        </div>

        {/* Progress bar */}
        {image_count > 0 && (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-slate-500 mb-1">
              <span>Tiến độ gán nhãn</span>
              <span className="text-slate-300">{progress}%</span>
            </div>
            <div className="h-1.5 bg-slate-700/60 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-blue-500 to-emerald-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
          <Calendar size={12} />
          {formatDate(created_at)}
        </div>
      </div>
    </button>
  );
};

export default ProjectCard;
