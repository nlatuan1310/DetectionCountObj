import React, { useState } from 'react';
import { cn } from '../../utils/cn';
import GlowButton from '../ui/GlowButton';

const AUGMENTATION_OPTIONS = [
  {
    key: 'horizontal_flip',
    label: 'Lật ngang',
    description: 'Lật ảnh theo trục ngang',
    icon: '↔',
    default: false,
  },
  {
    key: 'vertical_flip',
    label: 'Lật dọc',
    description: 'Lật ảnh theo trục dọc',
    icon: '↕',
    default: false,
  },
  {
    key: 'safe_rotate',
    label: 'Xoay an toàn',
    description: 'Xoay ảnh ±15° (giữ nguyên kích thước)',
    icon: '🔄',
    default: false,
  },
  {
    key: 'brightness_contrast',
    label: 'Độ sáng/Tương phản',
    description: 'Thay đổi brightness ±20%, contrast ±20%',
    icon: '☀️',
    default: false,
  },
  {
    key: 'blur',
    label: 'Làm mờ',
    description: 'Gaussian Blur kernel 3-5',
    icon: '💧',
    default: false,
  },
  {
    key: 'gaussian_noise',
    label: 'Nhiễu hạt',
    description: 'Gaussian Noise var_limit (10, 50)',
    icon: '⚡',
    default: false,
  },
];

const AugmentationConfigForm = ({ onSubmit, initialConfig = {}, versionName = '' }) => {
  const [name, setName] = useState(versionName);
  const [config, setConfig] = useState(() => {
    const initial = {};
    AUGMENTATION_OPTIONS.forEach((opt) => {
      initial[opt.key] = initialConfig[opt.key] ?? opt.default;
    });
    initial.multiplier = initialConfig.multiplier ?? 3;
    return initial;
  });
  const [submitting, setSubmitting] = useState(false);

  const toggleOption = (key) => {
    setConfig((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const enabledCount = AUGMENTATION_OPTIONS.filter((opt) => config[opt.key]).length;

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await onSubmit({ version_name: name || null, augmentation_config: config });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Version Name */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">
          Tên Version (tùy chọn)
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Auto-generate (v1, v2...)"
          className={cn(
            'w-full px-4 py-2.5 rounded-xl text-sm',
            'bg-slate-800/60 border border-slate-700/50 text-slate-200',
            'placeholder:text-slate-500',
            'focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50',
            'transition-all duration-200'
          )}
        />
      </div>

      {/* Augmentation Options */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Augmentations ({enabledCount} đã chọn)
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {AUGMENTATION_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => toggleOption(opt.key)}
              className={cn(
                'flex items-center gap-3 p-3 rounded-xl text-left',
                'border transition-all duration-200',
                config[opt.key]
                  ? 'bg-blue-500/10 border-blue-500/30 text-blue-300'
                  : 'bg-slate-800/30 border-slate-700/40 text-slate-400 hover:bg-slate-800/50'
              )}
            >
              <span className="text-lg">{opt.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{opt.label}</p>
                <p className="text-[11px] text-slate-500 truncate">{opt.description}</p>
              </div>
              <div
                className={cn(
                  'w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all',
                  config[opt.key]
                    ? 'bg-blue-500 border-blue-500 text-white'
                    : 'border-slate-600'
                )}
              >
                {config[opt.key] && (
                  <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Multiplier */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">
          Hệ số nhân bản: <span className="text-blue-400 font-bold">{config.multiplier}x</span>
        </label>
        <input
          type="range"
          min="1"
          max="10"
          value={config.multiplier}
          onChange={(e) => setConfig((prev) => ({ ...prev, multiplier: parseInt(e.target.value) }))}
          className="w-full accent-blue-500"
        />
        <div className="flex justify-between text-[10px] text-slate-600 mt-1">
          <span>1x (gốc)</span>
          <span>5x</span>
          <span>10x (mạnh)</span>
        </div>
      </div>

      {/* Submit */}
      <div className="pt-2">
        <GlowButton
          variant="blue"
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full"
        >
          {submitting ? 'Đang tạo...' : 'Tạo Version'}
        </GlowButton>
      </div>
    </div>
  );
};

export default AugmentationConfigForm;
