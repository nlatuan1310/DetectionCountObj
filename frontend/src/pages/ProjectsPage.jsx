import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderPlus, Search, Loader2 } from 'lucide-react';
import { cn } from '../utils/cn';
import GlowButton from '../components/ui/GlowButton';
import ProjectCard from '../components/Dataset/ProjectCard';
import { getProjects, createProject } from '../services/project_service';

const ProjectsPage = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchProjects = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getProjects();
      setProjects(data.projects || []);
    } catch (err) {
      setError(err.response?.data?.detail || 'Không thể tải danh sách projects');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await createProject({ name: newName.trim(), description: newDesc.trim() || null });
      setNewName('');
      setNewDesc('');
      setShowCreate(false);
      await fetchProjects();
    } catch (err) {
      setError(err.response?.data?.detail || 'Tạo project thất bại');
    } finally {
      setCreating(false);
    }
  };

  const filtered = projects.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Projects</h2>
          <p className="text-sm text-slate-400 mt-1">Quản lý các đợt thu thập dữ liệu</p>
        </div>
        <GlowButton variant="blue" onClick={() => setShowCreate(true)}>
          <FolderPlus size={16} className="mr-2" />
          Tạo Project
        </GlowButton>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm kiếm project..."
          className={cn(
            'w-full pl-10 pr-4 py-2.5 rounded-xl text-sm',
            'bg-slate-800/40 border border-slate-700/50 text-slate-200',
            'placeholder:text-slate-500',
            'focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50',
            'transition-all duration-200'
          )}
        />
      </div>

      {/* Create form (inline) */}
      {showCreate && (
        <div className="bg-slate-800/40 backdrop-blur-md border border-slate-700/50 rounded-2xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-slate-200">Tạo Project Mới</h3>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Tên project (VD: Thêm Sản Phẩm A - 18/05)"
            autoFocus
            className={cn(
              'w-full px-4 py-2.5 rounded-xl text-sm',
              'bg-slate-900/60 border border-slate-700/50 text-slate-200',
              'placeholder:text-slate-500',
              'focus:outline-none focus:ring-2 focus:ring-blue-500/30',
              'transition-all duration-200'
            )}
          />
          <input
            type="text"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Mô tả ngắn (tùy chọn)"
            className={cn(
              'w-full px-4 py-2.5 rounded-xl text-sm',
              'bg-slate-900/60 border border-slate-700/50 text-slate-200',
              'placeholder:text-slate-500',
              'focus:outline-none focus:ring-2 focus:ring-blue-500/30',
              'transition-all duration-200'
            )}
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => { setShowCreate(false); setNewName(''); setNewDesc(''); }}
              className="px-4 py-2 text-sm text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              Hủy
            </button>
            <GlowButton variant="blue" onClick={handleCreate} disabled={!newName.trim() || creating}>
              {creating ? 'Đang tạo...' : 'Tạo'}
            </GlowButton>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-blue-400" />
        </div>
      )}

      {/* Projects Grid */}
      {!isLoading && filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onClick={() => navigate(`/projects/${project.id}`)}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-slate-500">
          <FolderPlus size={48} className="mb-3 text-slate-600" />
          <p className="text-sm">
            {search ? 'Không tìm thấy project nào' : 'Chưa có project nào'}
          </p>
          <p className="text-xs text-slate-600 mt-1">
            Tạo project mới để bắt đầu thu thập dữ liệu
          </p>
        </div>
      )}
    </div>
  );
};

export default ProjectsPage;
