import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Video, Package, FolderOpen, Layers, Settings } from 'lucide-react';
import { cn } from '../../utils/cn';

const Sidebar = () => {
  const navItems = [
    { name: 'Dashboard', path: '/', icon: <LayoutDashboard size={20} /> },
    { name: 'Camera Stream', path: '/stream', icon: <Video size={20} /> },
    { name: 'Loại Sản Phẩm', path: '/products', icon: <Package size={20} /> },
    { name: 'Projects', path: '/projects', icon: <FolderOpen size={20} /> },
    { name: 'Cài Đặt', path: '/settings', icon: <Settings size={20} /> },
  ];

  return (
    <aside className="w-64 h-screen bg-slate-900/50 backdrop-blur-xl border-r border-slate-800/50 flex flex-col transition-all duration-300">
      <div className="p-6 flex items-center gap-3 border-b border-slate-800/50">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center font-bold text-white shadow-[0_0_15px_rgba(59,130,246,0.5)]">
          V
        </div>
        <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
          VisionAI
        </h1>
      </div>
      
      <nav className="flex-1 p-4 flex flex-col gap-2">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-sm font-medium",
                isActive 
                  ? "bg-blue-500/10 text-blue-400 shadow-[inset_0_0_10px_rgba(59,130,246,0.1)] border border-blue-500/20" 
                  : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
              )
            }
          >
            {item.icon}
            {item.name}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-800/50 text-xs text-slate-500 text-center">
        &copy; 2026 VisionAI Platform
      </div>
    </aside>
  );
};

export default Sidebar;
