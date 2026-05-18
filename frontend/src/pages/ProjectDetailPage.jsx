import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, Trash2, Loader2 } from 'lucide-react';
import { cn } from '../utils/cn';
import GlowButton from '../components/ui/GlowButton';
import ImageGrid from '../components/Dataset/ImageGrid';
import ImageUploadModal from '../components/Dataset/ImageUploadModal';
import { getProject, deleteProject } from '../services/project_service';
import { getProjectImages, uploadImages, deleteImage, toggleGolden } from '../services/image_service';

const ProjectDetailPage = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [images, setImages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [projectData, imagesData] = await Promise.all([
        getProject(projectId),
        getProjectImages(projectId),
      ]);
      setProject(projectData);
      setImages(imagesData);
    } catch (err) {
      setError(err.response?.data?.detail || 'Không thể tải dữ liệu project');
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleUpload = async (files, isBackground) => {
    await uploadImages(projectId, files, isBackground);
    await fetchData();
  };

  const handleToggleGolden = async (image) => {
    try {
      await toggleGolden(image.id);
      await fetchData();
    } catch (err) {
      setError('Toggle golden thất bại');
    }
  };

  const handleDeleteImage = async (image) => {
    if (!window.confirm(`Xóa ảnh "${image.original_filename}"?`)) return;
    try {
      await deleteImage(image.id);
      await fetchData();
    } catch (err) {
      setError('Xóa ảnh thất bại');
    }
  };

  const handleDeleteProject = async () => {
    try {
      await deleteProject(projectId);
      navigate('/projects');
    } catch (err) {
      setError('Xóa project thất bại');
    }
  };

  const handleImageClick = (image) => {
    navigate(`/projects/${projectId}/annotate/${image.id}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={24} className="animate-spin text-blue-400" />
      </div>
    );
  }

  if (error && !project) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <p className="text-red-400 text-sm">{error}</p>
        <button
          onClick={() => navigate('/projects')}
          className="text-sm text-blue-400 hover:underline"
        >
          ← Quay lại danh sách
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <button
            onClick={() => navigate('/projects')}
            className="mt-1 p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">{project?.name}</h2>
            {project?.description && (
              <p className="text-sm text-slate-400 mt-1">{project.description}</p>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <GlowButton variant="blue" onClick={() => setShowUpload(true)}>
            <Upload size={16} className="mr-2" />
            Upload Ảnh
          </GlowButton>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="p-2.5 rounded-xl border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-colors"
            title="Xóa Project"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex gap-4 text-sm">
        <div className="px-4 py-2 rounded-xl bg-slate-800/40 border border-slate-700/50">
          <span className="text-slate-400">Tổng ảnh: </span>
          <span className="text-white font-semibold">{images.length}</span>
        </div>
        <div className="px-4 py-2 rounded-xl bg-slate-800/40 border border-slate-700/50">
          <span className="text-slate-400">Đã gán nhãn: </span>
          <span className="text-emerald-400 font-semibold">
            {images.filter((i) => i.annotation_count > 0).length}
          </span>
        </div>
        <div className="px-4 py-2 rounded-xl bg-slate-800/40 border border-slate-700/50">
          <span className="text-slate-400">Golden: </span>
          <span className="text-amber-400 font-semibold">
            {images.filter((i) => i.is_golden).length}
          </span>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Image Grid */}
      <ImageGrid
        images={images}
        onImageClick={handleImageClick}
        onToggleGolden={handleToggleGolden}
        onDeleteImage={handleDeleteImage}
      />

      {/* Upload Modal */}
      <ImageUploadModal
        isOpen={showUpload}
        onClose={() => setShowUpload(false)}
        onUpload={handleUpload}
      />

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowDeleteConfirm(false)}
          />
          <div className="relative bg-slate-900/95 border border-slate-700/50 rounded-2xl p-6 max-w-md mx-4 space-y-4">
            <h3 className="text-lg font-semibold text-white">Xóa Project?</h3>
            <p className="text-sm text-slate-400">
              Hành động này sẽ xóa toàn bộ <strong>{images.length} ảnh</strong> và annotations liên quan.
              Không thể hoàn tác.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleDeleteProject}
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

export default ProjectDetailPage;
