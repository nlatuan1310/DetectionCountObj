import React from 'react';
import { cn } from '../../utils/cn';
import { getClassColor } from '../../utils/colors';

const ClassBadge = ({ name, classId, color, isActive = true, className }) => {
  // Ưu tiên dùng classId để sinh màu giống hệt Canvas
  const badgeColor = color || (classId ? getClassColor(classId) : getClassColor(name ? name.charCodeAt(0) : 1));

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold',
        'border transition-all duration-200',
        isActive
          ? 'border-white/10 text-white'
          : 'border-slate-700/50 text-slate-500 line-through opacity-60',
        className
      )}
      style={{
        backgroundColor: isActive ? `${badgeColor}20` : 'transparent',
        borderColor: isActive ? `${badgeColor}40` : undefined,
        color: isActive ? badgeColor : undefined,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: isActive ? badgeColor : '#64748b' }}
      />
      {name}
    </span>
  );
};

export default ClassBadge;
