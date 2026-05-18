import React from 'react';
import { Star, Trash2, Image as ImageIcon } from 'lucide-react';
import { cn } from '../../utils/cn';

const ImageGrid = ({ images = [], onImageClick, onToggleGolden, onDeleteImage }) => {
  if (images.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-500">
        <ImageIcon size={48} className="mb-3 text-slate-600" />
        <p className="text-sm">Chưa có ảnh nào</p>
        <p className="text-xs text-slate-600 mt-1">Upload ảnh để bắt đầu gán nhãn</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
      {images.map((image) => (
        <div
          key={image.id}
          className={cn(
            'group relative rounded-xl overflow-hidden border',
            'bg-slate-800/40 border-slate-700/50',
            'hover:border-slate-600/50 hover:shadow-lg',
            'transition-all duration-200 cursor-pointer aspect-square'
          )}
        >
          {/* Ảnh */}
          <button
            className="w-full h-full focus:outline-none"
            onClick={() => onImageClick?.(image)}
          >
            <img
              src={image.cloudinary_url || `/api/v1/static/${image.local_path}`}
              alt={image.original_filename || `Image ${image.id}`}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
          </button>

          {/* Overlay gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

          {/* Badges */}
          <div className="absolute top-2 left-2 flex gap-1.5">
            {image.is_golden && (
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-500/90 text-amber-950 shadow-sm">
                GOLDEN
              </span>
            )}
            {image.is_background && (
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-500/90 text-white shadow-sm">
                BG
              </span>
            )}
            {image.annotation_count > 0 && (
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/90 text-emerald-950 shadow-sm">
                {image.annotation_count} box
              </span>
            )}
          </div>

          {/* Action buttons (hiện khi hover) */}
          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {onToggleGolden && !image.is_background && (
              <button
                onClick={(e) => { e.stopPropagation(); onToggleGolden(image); }}
                className={cn(
                  'p-1.5 rounded-lg backdrop-blur-sm transition-all duration-200',
                  image.is_golden
                    ? 'bg-amber-500/80 text-amber-950 hover:bg-amber-400'
                    : 'bg-black/40 text-white hover:bg-amber-500/60'
                )}
                title={image.is_golden ? 'Bỏ Golden' : 'Đánh dấu Golden'}
              >
                <Star size={14} fill={image.is_golden ? 'currentColor' : 'none'} />
              </button>
            )}
            {onDeleteImage && (
              <button
                onClick={(e) => { e.stopPropagation(); onDeleteImage(image); }}
                className="p-1.5 rounded-lg bg-black/40 text-white hover:bg-red-500/80 backdrop-blur-sm transition-all duration-200"
                title="Xóa ảnh"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>

          {/* Filename */}
          <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <p className="text-[10px] text-white/80 truncate">
              {image.original_filename}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ImageGrid;
