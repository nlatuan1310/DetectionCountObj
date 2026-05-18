import React, { useState, useRef, useCallback } from 'react';
import { Upload, X, Image as ImageIcon, AlertCircle } from 'lucide-react';
import { cn } from '../../utils/cn';
import GlowButton from '../ui/GlowButton';

const ImageUploadModal = ({ isOpen, onClose, onUpload, isBackground = false }) => {
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);
  const dropRef = useRef(null);

  const MAX_FILES = 20;
  const MAX_SIZE_MB = 10;

  const handleFiles = useCallback((newFiles) => {
    setError(null);
    const validFiles = [];
    const errors = [];

    Array.from(newFiles).forEach((file) => {
      if (!file.type.startsWith('image/')) {
        errors.push(`${file.name}: Không phải file ảnh`);
        return;
      }
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        errors.push(`${file.name}: Vượt quá ${MAX_SIZE_MB}MB`);
        return;
      }
      validFiles.push(file);
    });

    if (files.length + validFiles.length > MAX_FILES) {
      errors.push(`Tối đa ${MAX_FILES} ảnh mỗi lần upload`);
      validFiles.splice(MAX_FILES - files.length);
    }

    if (errors.length > 0) {
      setError(errors.join('\n'));
    }

    // Tạo preview URLs
    const newPreviews = validFiles.map((file) => ({
      file,
      url: URL.createObjectURL(file),
      name: file.name,
    }));

    setFiles((prev) => [...prev, ...validFiles]);
    setPreviews((prev) => [...prev, ...newPreviews]);
  }, [files.length]);

  const removeFile = (index) => {
    URL.revokeObjectURL(previews[index].url);
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const clearAll = () => {
    previews.forEach((p) => URL.revokeObjectURL(p.url));
    setFiles([]);
    setPreviews([]);
    setError(null);
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dropRef.current?.classList.remove('border-blue-500');
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropRef.current?.classList.add('border-blue-500');
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    dropRef.current?.classList.remove('border-blue-500');
  };

  const handleSubmit = async () => {
    if (files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      await onUpload(files, isBackground);
      clearAll();
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Upload thất bại');
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    if (!uploading) {
      clearAll();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl mx-4 bg-slate-900/95 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-700/50">
          <div>
            <h3 className="text-lg font-semibold text-white">
              {isBackground ? 'Upload Ảnh Trống (Background)' : 'Upload Ảnh'}
            </h3>
            <p className="text-sm text-slate-400 mt-0.5">
              Kéo thả hoặc chọn file • Tối đa {MAX_FILES} ảnh, {MAX_SIZE_MB}MB/ảnh
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={uploading}
            className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Drop Zone */}
          <div
            ref={dropRef}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer',
              'border-slate-700/50 hover:border-blue-500/50',
              'bg-slate-800/20 hover:bg-slate-800/40',
              'transition-all duration-200'
            )}
          >
            <Upload size={36} className="mx-auto text-slate-500 mb-3" />
            <p className="text-sm text-slate-300">
              Kéo thả ảnh vào đây hoặc <span className="text-blue-400 underline">chọn file</span>
            </p>
            <p className="text-xs text-slate-500 mt-1">PNG, JPG, JPEG, WEBP</p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <pre className="whitespace-pre-wrap">{error}</pre>
            </div>
          )}

          {/* Previews */}
          {previews.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-300">{previews.length} ảnh đã chọn</span>
                <button
                  onClick={clearAll}
                  className="text-xs text-slate-500 hover:text-red-400 transition-colors"
                >
                  Xóa tất cả
                </button>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                {previews.map((preview, idx) => (
                  <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden border border-slate-700/50">
                    <img
                      src={preview.url}
                      alt={preview.name}
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={() => removeFile(idx)}
                      className="absolute top-1 right-1 p-0.5 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80"
                    >
                      <X size={12} />
                    </button>
                    <div className="absolute bottom-0 left-0 right-0 px-1 py-0.5 bg-black/50">
                      <p className="text-[9px] text-white/80 truncate">{preview.name}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-700/50">
          <button
            onClick={handleClose}
            disabled={uploading}
            className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-slate-800"
          >
            Hủy
          </button>
          <GlowButton
            variant="blue"
            onClick={handleSubmit}
            disabled={files.length === 0 || uploading}
          >
            {uploading ? 'Đang upload...' : `Upload ${files.length} ảnh`}
          </GlowButton>
        </div>
      </div>
    </div>
  );
};

export default ImageUploadModal;
