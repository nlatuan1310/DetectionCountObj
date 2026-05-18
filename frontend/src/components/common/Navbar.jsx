import React from 'react';
import { Bell, Search, User } from 'lucide-react';

const Navbar = () => {
  return (
    <header className="h-16 border-b border-slate-800/50 bg-slate-900/50 backdrop-blur-xl flex items-center justify-between px-6 sticky top-0 z-10">
      <div className="flex items-center gap-4">
        {/* Search Bar - placeholder */}
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
          <input 
            type="text" 
            placeholder="Tìm kiếm..." 
            className="bg-slate-800/50 border border-slate-700/50 rounded-full pl-10 pr-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all w-64 group-hover:bg-slate-800"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button className="p-2 rounded-full text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors relative">
          <Bell size={20} />
          <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full shadow-[0_0_5px_rgba(244,63,94,0.8)]"></span>
        </button>
        <div className="h-8 w-8 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 p-[2px] cursor-pointer hover:shadow-[0_0_10px_rgba(99,102,241,0.5)] transition-all">
          <div className="h-full w-full bg-slate-900 rounded-full flex items-center justify-center">
            <User size={16} className="text-slate-300" />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
