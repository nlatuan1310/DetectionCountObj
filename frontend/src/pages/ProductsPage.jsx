import React from 'react';
import GlowButton from '../components/ui/GlowButton';

const ProductsPage = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Products Management</h2>
        <GlowButton variant="pink">
          Add New Product
        </GlowButton>
      </div>
      
      <div className="bg-slate-800/40 backdrop-blur-md border border-slate-700/50 rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-slate-700/50">
          <p className="text-slate-400">Danh sách các Class sản phẩm chạy trên băng chuyền.</p>
        </div>
        <div className="p-6 flex items-center justify-center h-64 text-slate-500">
          Table Placeholder
        </div>
      </div>
    </div>
  );
};

export default ProductsPage;
