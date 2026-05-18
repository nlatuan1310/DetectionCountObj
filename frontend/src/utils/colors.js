export const getClassColor = (classId, alpha = 1) => {
  if (!classId) return `hsla(200, 70%, 60%, ${alpha})`; // fallback
  const hue = (classId * 137) % 360;
  return `hsla(${hue}, 80%, 60%, ${alpha})`;
};
