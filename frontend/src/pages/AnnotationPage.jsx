import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Loader2, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { cn } from '../utils/cn';
import GlowButton from '../components/ui/GlowButton';
import AnnotationCanvas from '../components/Dataset/AnnotationCanvas';
import ClassBadge from '../components/Dataset/ClassBadge';
import { getProjectImages } from '../services/image_service';
import { getAnnotations, createAnnotations, deleteAnnotation } from '../services/annotation_service';
import { getClasses, createClass, deleteClass } from '../services/class_service';

const AnnotationPage = () => {
  const { projectId, imageId } = useParams();
  const navigate = useNavigate();

  const [images, setImages] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [annotations, setAnnotations] = useState([]);
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingAnnotations, setPendingAnnotations] = useState([]);
  const [focusedAnnotationId, setFocusedAnnotationId] = useState(null);
  const [error, setError] = useState(null);

  const currentImage = images[currentImageIndex] || null;

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const [imagesData, classesData] = await Promise.all([
          getProjectImages(projectId),
          getClasses(),
        ]);

        // Lọc bỏ ảnh background
        const labelableImages = imagesData.filter((img) => !img.is_background);
        setImages(labelableImages);
        setClasses(classesData);

        // Tìm index ảnh được chọn
        const idx = labelableImages.findIndex((img) => img.id === parseInt(imageId));
        setCurrentImageIndex(idx >= 0 ? idx : 0);

        // Auto-select first active class
        const activeClasses = classesData.filter((c) => c.is_active);
        if (activeClasses.length > 0) {
          setSelectedClassId(activeClasses[0].id);
        }
      } catch (err) {
        setError('Không thể tải dữ liệu');
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [projectId, imageId]);

  // Load annotations khi chuyển ảnh
  const loadAnnotations = useCallback(async () => {
    if (!currentImage) return;
    try {
      const data = await getAnnotations(currentImage.id);
      setAnnotations(data);
      setPendingAnnotations([]);
    } catch (err) {
      console.error('Load annotations failed:', err);
    }
  }, [currentImage]);

  useEffect(() => {
    loadAnnotations();
  }, [loadAnnotations]);

  const handleAnnotationCreate = async (bboxData) => {
    let classId = bboxData.class_id;
    let finalClassName = bboxData.className;

    if (!classId && finalClassName) {
      const existing = classes.find((c) => c.name.toLowerCase() === finalClassName.toLowerCase());
      if (existing) {
        classId = existing.id;
      } else {
        try {
          const newClass = await createClass({ name: finalClassName });
          setClasses((prev) => [...prev, newClass]);
          classId = newClass.id;
        } catch (err) {
          setError('Lỗi khi tạo class mới');
          return;
        }
      }
    }

    if (!classId) return;

    setPendingAnnotations((prev) => [
      ...prev,
      {
        ...bboxData,
        class_id: classId,
        class_name: finalClassName || classes.find((c) => c.id === classId)?.name,
      },
    ]);
  };

  const handleAnnotationDelete = async (annotationId) => {
    // Check nếu là pending (chưa lưu)
    if (typeof annotationId === 'string' && annotationId.startsWith('pending_')) {
      const idx = parseInt(annotationId.replace('pending_', ''));
      setPendingAnnotations((prev) => prev.filter((_, i) => i !== idx));
      return;
    }

    try {
      await deleteAnnotation(annotationId);
      await loadAnnotations();
    } catch (err) {
      setError('Xóa annotation thất bại');
    }
  };

  const handleClassDelete = async (cls, e) => {
    e.stopPropagation();
    
    const isUsedInCurrent = allAnnotations.some(a => a.class_id === cls.id);
    if (isUsedInCurrent || cls.annotation_count > 0) {
      window.alert(`Class "${cls.name}" đang được sử dụng (có annotations). Không thể xóa!`);
      return;
    }

    if (window.confirm(`Bạn có chắc chắn muốn xóa class "${cls.name}" không?`)) {
      try {
        await deleteClass(cls.id);
        setClasses(prev => prev.filter(c => c.id !== cls.id));
        if (selectedClassId === cls.id) setSelectedClassId(null);
      } catch (err) {
        window.alert(err.response?.data?.detail || 'Xóa class thất bại');
      }
    }
  };

  const handleSave = async () => {
    if (pendingAnnotations.length === 0) return;
    setIsSaving(true);
    setError(null);
    try {
      await createAnnotations(currentImage.id, pendingAnnotations);
      await loadAnnotations();
    } catch (err) {
      setError('Lưu annotations thất bại');
    } finally {
      setIsSaving(false);
    }
  };

  const goToImage = (direction) => {
    const newIndex = currentImageIndex + direction;
    if (newIndex >= 0 && newIndex < images.length) {
      setCurrentImageIndex(newIndex);
      setPendingAnnotations([]);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') goToImage(-1);
      if (e.key === 'ArrowRight' || e.key === 'd') goToImage(1);
      if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentImageIndex, pendingAnnotations, images.length]);

  // Merge saved + pending annotations cho canvas
  const allAnnotations = [
    ...annotations,
    ...pendingAnnotations.map((bbox, idx) => ({
      id: `pending_${idx}`,
      image_id: currentImage?.id,
      ...bbox,
      class_name: classes.find((c) => c.id === bbox.class_id)?.name || '',
    })),
  ];

  const imageUrl = currentImage?.cloudinary_url || null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={24} className="animate-spin text-blue-400" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Top bar */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/projects/${projectId}`)}
            className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-lg font-semibold">Gán Nhãn</h2>
            <p className="text-xs text-slate-400">
              {currentImage?.original_filename} • Ảnh {currentImageIndex + 1}/{images.length}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Navigation */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => goToImage(-1)}
              disabled={currentImageIndex === 0}
              className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30 transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <span className="text-sm text-slate-300 min-w-[3rem] text-center">
              {currentImageIndex + 1} / {images.length}
            </span>
            <button
              onClick={() => goToImage(1)}
              disabled={currentImageIndex === images.length - 1}
              className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30 transition-colors"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          {/* Save */}
          <GlowButton
            variant="blue"
            onClick={handleSave}
            disabled={pendingAnnotations.length === 0 || isSaving}
          >
            <Save size={16} className="mr-2" />
            {isSaving ? 'Đang lưu...' : `Lưu (${pendingAnnotations.length})`}
          </GlowButton>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm shrink-0">
          {error}
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* Canvas */}
        <div className="flex-1 min-w-0">
          <AnnotationCanvas
            imageUrl={imageUrl}
            annotations={allAnnotations}
            selectedClassId={selectedClassId}
            focusedAnnotationId={focusedAnnotationId}
            classes={classes}
            onAnnotationCreate={handleAnnotationCreate}
            onAnnotationDelete={handleAnnotationDelete}
          />
        </div>

        {/* Sidebar — Class selector + Annotation list */}
        <div className="w-64 shrink-0 flex flex-col gap-4">
          {/* Class selector */}
          <div className="bg-slate-800/40 backdrop-blur-md border border-slate-700/50 rounded-xl p-4">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Quản lý Class
            </h4>
            <div className="flex flex-col gap-1.5">
              {classes.filter((c) => c.is_active).map((cls) => (
                <div
                  key={cls.id}
                  onClick={() => setSelectedClassId(selectedClassId === cls.id ? null : cls.id)}
                  className={cn(
                    'group flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all duration-200 cursor-pointer',
                    selectedClassId === cls.id
                      ? 'bg-blue-500/15 border border-blue-500/30 text-blue-300'
                      : 'text-slate-400 hover:bg-slate-800/50 border border-transparent'
                  )}
                >
                  <ClassBadge name={cls.name} classId={cls.id} isActive={cls.is_active} />
                  <button
                    onClick={(e) => handleClassDelete(cls, e)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-red-400 transition-colors rounded"
                    title="Xóa class"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              {classes.filter((c) => c.is_active).length === 0 && (
                <p className="text-xs text-slate-500">
                  Chưa có class nào. Vẽ một box để tạo class mới!
                </p>
              )}
            </div>
          </div>

          {/* Annotation list */}
          <div className="flex-1 bg-slate-800/40 backdrop-blur-md border border-slate-700/50 rounded-xl p-4 overflow-y-auto">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Annotations ({allAnnotations.length})
            </h4>
            <div className="space-y-1.5">
              {allAnnotations.map((ann, idx) => (
                <div
                  key={ann.id}
                  onClick={() => setFocusedAnnotationId(focusedAnnotationId === ann.id ? null : ann.id)}
                  className={cn(
                    'flex items-center justify-between px-3 py-2 rounded-lg border text-xs transition-colors cursor-pointer',
                    focusedAnnotationId === ann.id
                      ? 'bg-blue-500/20 border-blue-500/40'
                      : 'bg-slate-900/40 border-slate-700/30 hover:bg-slate-800'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <ClassBadge
                      name={ann.class_name || classes.find((c) => c.id === ann.class_id)?.name || '?'}
                      classId={ann.class_id}
                    />
                  </div>
                  <button
                    onClick={() => handleAnnotationDelete(ann.id)}
                    className="text-slate-500 hover:text-red-400 transition-colors p-1"
                    title="Xóa"
                  >
                    ×
                  </button>
                </div>
              ))}
              {allAnnotations.length === 0 && (
                <p className="text-xs text-slate-500 text-center py-4">
                  Chưa có annotation
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnnotationPage;
