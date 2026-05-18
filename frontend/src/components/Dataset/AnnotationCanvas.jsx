import React, { useRef, useState, useEffect, useCallback } from 'react';
import { cn } from '../../utils/cn';
import { getClassColor } from '../../utils/colors';

/**
 * AnnotationCanvas — Canvas HTML5 để vẽ bounding box annotation giống Roboflow.
 */
const AnnotationCanvas = ({
  imageUrl,
  annotations = [],
  selectedClassId,
  focusedAnnotationId,
  classes = [],
  onAnnotationCreate,
  onAnnotationDelete,
  onAnnotationUpdate,
  readOnly = false,
}) => {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [drawing, setDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState(null);
  const [currentPoint, setCurrentPoint] = useState(null);
  const [mousePos, setMousePos] = useState(null);
  const [hoveredAnnotation, setHoveredAnnotation] = useState(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  // Zoom & Pan states
  const [viewportZoom, setViewportZoom] = useState(1);
  const [viewportPan, setViewportPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [isSpaceDown, setIsSpaceDown] = useState(false);

  // State cho inline class popup
  const [draftBox, setDraftBox] = useState(null);
  const [searchText, setSearchText] = useState('');

  const getClassName = useCallback((classId) => {
    const cls = classes.find((c) => c.id === classId);
    return cls?.name || `Class ${classId}`;
  }, [classes]);

  // Tính toán vị trí hiển thị ảnh
  const calculateFit = useCallback(() => {
    if (!containerRef.current || !imageRef.current) return;
    const container = containerRef.current;
    const img = imageRef.current;

    const containerW = container.clientWidth;
    const containerH = container.clientHeight;
    const imgW = img.naturalWidth;
    const imgH = img.naturalHeight;

    if (imgW === 0 || imgH === 0) return;

    const scaleX = containerW / imgW;
    const scaleY = containerH / imgH;
    const newScale = Math.min(scaleX, scaleY, 1);

    const offsetX = (containerW - imgW * newScale) / 2;
    const offsetY = (containerH - imgH * newScale) / 2;

    setScale(newScale);
    setOffset({ x: offsetX, y: offsetY });
    setImageDimensions({ width: imgW, height: imgH });
    setViewportZoom(1);
    setViewportPan({ x: 0, y: 0 });
  }, []);

  // Load ảnh
  useEffect(() => {
    if (!imageUrl) return;
    setImageLoaded(false);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageRef.current = img;
      setImageLoaded(true);
      calculateFit();
    };
    img.src = imageUrl;
  }, [imageUrl, calculateFit]);

  // Resize observer
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => {
      if (imageLoaded) calculateFit();
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [imageLoaded, calculateFit]);

  // Chuyển đổi tọa độ canvas → YOLO normalized
  const canvasToYolo = useCallback((x1, y1, x2, y2) => {
    const imgW = imageDimensions.width;
    const imgH = imageDimensions.height;
    const effScale = scale * viewportZoom;
    const effOffsetX = offset.x + viewportPan.x;
    const effOffsetY = offset.y + viewportPan.y;

    const ix1 = (Math.min(x1, x2) - effOffsetX) / effScale;
    const iy1 = (Math.min(y1, y2) - effOffsetY) / effScale;
    const ix2 = (Math.max(x1, x2) - effOffsetX) / effScale;
    const iy2 = (Math.max(y1, y2) - effOffsetY) / effScale;

    const cx1 = Math.max(0, Math.min(ix1, imgW));
    const cy1 = Math.max(0, Math.min(iy1, imgH));
    const cx2 = Math.max(0, Math.min(ix2, imgW));
    const cy2 = Math.max(0, Math.min(iy2, imgH));

    const w = cx2 - cx1;
    const h = cy2 - cy1;
    if (w < 3 || h < 3) return null;

    return {
      bbox_x: (cx1 + w / 2) / imgW,
      bbox_y: (cy1 + h / 2) / imgH,
      bbox_w: w / imgW,
      bbox_h: h / imgH,
    };
  }, [imageDimensions, scale, offset, viewportZoom, viewportPan]);

  // Chuyển đổi YOLO → canvas coords
  const yoloToCanvas = useCallback((bbox) => {
    const imgW = imageDimensions.width;
    const imgH = imageDimensions.height;
    const effScale = scale * viewportZoom;
    const effOffsetX = offset.x + viewportPan.x;
    const effOffsetY = offset.y + viewportPan.y;

    const x = (bbox.bbox_x - bbox.bbox_w / 2) * imgW * effScale + effOffsetX;
    const y = (bbox.bbox_y - bbox.bbox_h / 2) * imgH * effScale + effOffsetY;
    const w = bbox.bbox_w * imgW * effScale;
    const h = bbox.bbox_h * imgH * effScale;

    return { x, y, w, h };
  }, [imageDimensions, scale, offset, viewportZoom, viewportPan]);

  // Vẽ canvas
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img || !imageLoaded) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = containerRef.current.getBoundingClientRect();
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);
    
    // Fill canvas background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, rect.width, rect.height);

    const effScale = scale * viewportZoom;
    const effOffsetX = offset.x + viewportPan.x;
    const effOffsetY = offset.y + viewportPan.y;
    const renderW = imageDimensions.width * effScale;
    const renderH = imageDimensions.height * effScale;

    ctx.drawImage(img, effOffsetX, effOffsetY, renderW, renderH);

    // Vẽ draftBox (đang chờ chọn class)
    if (draftBox && !drawing) {
      const { x, y, w, h } = draftBox.canvasRect;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);
    }

    const drawAnnotation = (ann, forceHover = false) => {
      const annRect = yoloToCanvas(ann);
      const color = getClassColor(ann.class_id);
      const isHovered = forceHover || hoveredAnnotation === ann.id;

      ctx.strokeStyle = color;
      ctx.lineWidth = isHovered ? 2.5 : 2;
      ctx.strokeRect(annRect.x, annRect.y, annRect.w, annRect.h);

      if (isHovered && !drawing) {
        const handleSize = 6;
        ctx.fillStyle = color;
        const corners = [
          { x: annRect.x, y: annRect.y },
          { x: annRect.x + annRect.w, y: annRect.y },
          { x: annRect.x, y: annRect.y + annRect.h },
          { x: annRect.x + annRect.w, y: annRect.y + annRect.h },
        ];
        corners.forEach(c => {
          ctx.fillRect(c.x - handleSize/2, c.y - handleSize/2, handleSize, handleSize);
        });
      }

      const label = ann.class_name || getClassName(ann.class_id);
      ctx.font = '600 12px Inter, system-ui, sans-serif';
      const textWidth = ctx.measureText(label).width;
      const labelHeight = 22;

      let labelY = annRect.y - labelHeight;
      if (labelY < effOffsetY) {
        labelY = annRect.y; 
      }

      ctx.fillStyle = color;
      ctx.fillRect(annRect.x, labelY, textWidth + 16, labelHeight);

      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = "rgba(0,0,0,0.3)";
      ctx.shadowBlur = 2;
      ctx.fillText(label, annRect.x + 8, labelY + 15);
      ctx.shadowBlur = 0;
    };

    // Vẽ các annotation KHÔNG focus trước
    annotations.forEach((ann) => {
      if (ann.id !== focusedAnnotationId) {
        drawAnnotation(ann);
      }
    });

    // Vẽ hiệu ứng dimming và annotation đang focus
    if (focusedAnnotationId) {
      const focusedAnn = annotations.find(a => a.id === focusedAnnotationId);
      if (focusedAnn) {
        const rect = yoloToCanvas(focusedAnn);
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.beginPath();
        // Rect bao quanh toàn bộ ảnh
        ctx.rect(effOffsetX, effOffsetY, renderW, renderH);
        // Rect khoét lỗ cho annotation
        ctx.rect(rect.x, rect.y, rect.w, rect.h);
        ctx.fill('evenodd');

        // Vẽ lại annotation đang focus lên trên cùng (giữ nguyên màu fill mặc định)
        drawAnnotation(focusedAnn, false);
      }
    }

    if (drawing && startPoint && currentPoint) {
      const color = selectedClassId ? getClassColor(selectedClassId) : '#ffffff';
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      
      const x = Math.min(startPoint.x, currentPoint.x);
      const y = Math.min(startPoint.y, currentPoint.y);
      const w = Math.abs(currentPoint.x - startPoint.x);
      const h = Math.abs(currentPoint.y - startPoint.y);

      ctx.strokeRect(x, y, w, h);

      ctx.font = '600 11px Inter, system-ui, sans-serif';
      const sizeText = `${Math.round(w / effScale)} x ${Math.round(h / effScale)}`;
      const tw = ctx.measureText(sizeText).width;
      
      const badgeY = y - 20 > effOffsetY ? y - 20 : y;
      ctx.fillStyle = color;
      ctx.fillRect(x, badgeY, tw + 12, 20);
      
      ctx.fillStyle = '#ffffff';
      ctx.fillText(sizeText, x + 6, badgeY + 14);
    }

    if (mousePos && !readOnly && !draftBox) {
      const color = drawing ? (selectedClassId ? getClassColor(selectedClassId) : '#ffffff') : 'rgba(255, 255, 255, 1)';
      ctx.strokeStyle = color;
      ctx.lineWidth = drawing ? 1 : 1.5;
      ctx.setLineDash(drawing ? [2, 2] : [4, 4]);

      const imgLeft = effOffsetX;
      const imgRight = effOffsetX + renderW;
      const imgTop = effOffsetY;
      const imgBottom = effOffsetY + renderH;

      if (mousePos.x >= imgLeft && mousePos.x <= imgRight && mousePos.y >= imgTop && mousePos.y <= imgBottom) {
        ctx.beginPath();
        ctx.moveTo(mousePos.x, imgTop);
        ctx.lineTo(mousePos.x, imgBottom);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(imgLeft, mousePos.y);
        ctx.lineTo(imgRight, mousePos.y);
        ctx.stroke();
      }

      ctx.setLineDash([]);
    }
  }, [
    imageLoaded, imageDimensions, scale, offset, annotations, viewportZoom, viewportPan,
    drawing, startPoint, currentPoint, mousePos, hoveredAnnotation,
    selectedClassId, draftBox, focusedAnnotationId, yoloToCanvas, getClassColor, getClassName, readOnly
  ]);

  useEffect(() => {
    requestAnimationFrame(draw);
  }, [draw]);

  const getCanvasPos = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space' && !draftBox && document.activeElement.tagName !== 'INPUT') {
        setIsSpaceDown(true);
        e.preventDefault();
      }
    };
    const handleKeyUp = (e) => {
      if (e.code === 'Space') {
        setIsSpaceDown(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [draftBox]);

  const handleWheel = useCallback((e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const delta = e.deltaY < 0 ? 0.1 : -0.1;
    setViewportZoom((prevZoom) => {
      let newZoom = prevZoom * (1 + delta);
      newZoom = Math.max(0.5, Math.min(newZoom, 10));
      
      setViewportPan((prevPan) => {
        const imageX = (mouseX - offset.x - prevPan.x) / prevZoom;
        const imageY = (mouseY - offset.y - prevPan.y) / prevZoom;
        return {
          x: mouseX - offset.x - imageX * newZoom,
          y: mouseY - offset.y - imageY * newZoom
        };
      });
      return newZoom;
    });
  }, [offset]);

  const handleMouseDown = (e) => {
    if (readOnly || draftBox) return; 
    const pos = getCanvasPos(e);

    if (e.button === 1 || isSpaceDown) {
      setIsPanning(true);
      setStartPoint({ ...pos, panX: viewportPan.x, panY: viewportPan.y });
      return;
    }
    
    const effScale = scale * viewportZoom;
    const effOffsetX = offset.x + viewportPan.x;
    const effOffsetY = offset.y + viewportPan.y;
    if (
      pos.x < effOffsetX || pos.x > effOffsetX + imageDimensions.width * effScale ||
      pos.y < effOffsetY || pos.y > effOffsetY + imageDimensions.height * effScale
    ) {
      return;
    }

    setDrawing(true);
    setStartPoint(pos);
    setCurrentPoint(pos);
  };

  const handleMouseMove = (e) => {
    const pos = getCanvasPos(e);
    setMousePos(pos);

    if (isPanning && startPoint) {
      setViewportPan({
        x: startPoint.panX + (pos.x - startPoint.x),
        y: startPoint.panY + (pos.y - startPoint.y)
      });
      return;
    }

    if (drawing) {
      const effScale = scale * viewportZoom;
      const effOffsetX = offset.x + viewportPan.x;
      const effOffsetY = offset.y + viewportPan.y;
      const clampedX = Math.max(effOffsetX, Math.min(pos.x, effOffsetX + imageDimensions.width * effScale));
      const clampedY = Math.max(effOffsetY, Math.min(pos.y, effOffsetY + imageDimensions.height * effScale));
      setCurrentPoint({ x: clampedX, y: clampedY });
      return;
    }

    let found = null;
    for (const ann of annotations) {
      const rect = yoloToCanvas(ann);
      if (
        pos.x >= rect.x && pos.x <= rect.x + rect.w &&
        pos.y >= rect.y && pos.y <= rect.y + rect.h
      ) {
        found = ann.id;
        break;
      }
    }
    setHoveredAnnotation(found);
  };

  const handleMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
      setStartPoint(null);
      return;
    }

    if (!drawing || !startPoint || !currentPoint) {
      setDrawing(false);
      return;
    }

    const bbox = canvasToYolo(startPoint.x, startPoint.y, currentPoint.x, currentPoint.y);
    if (bbox) {
      // Luôn hiện popup draftBox để xác nhận hoặc chọn class
      const x = Math.min(startPoint.x, currentPoint.x);
      const y = Math.min(startPoint.y, currentPoint.y);
      const w = Math.abs(currentPoint.x - startPoint.x);
      const h = Math.abs(currentPoint.y - startPoint.y);
      setDraftBox({ ...bbox, canvasRect: { x, y, w, h } });
      setSearchText('');
    }

    setDrawing(false);
    setStartPoint(null);
    setCurrentPoint(null);
  };

  const handleDoubleClick = (e) => {
    if (readOnly) return;
    const pos = getCanvasPos(e);

    for (const ann of annotations) {
      const rect = yoloToCanvas(ann);
      if (
        pos.x >= rect.x && pos.x <= rect.x + rect.w &&
        pos.y >= rect.y && pos.y <= rect.y + rect.h
      ) {
        onAnnotationDelete?.(ann.id);
        break;
      }
    }
  };

  const handleMouseLeave = () => {
    setDrawing(false); 
    setIsPanning(false);
    setStartPoint(null);
    setHoveredAnnotation(null);
    setMousePos(null);
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
  };

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      className={cn(
        'relative w-full h-full min-h-[400px] bg-[#0c0d12] rounded-xl overflow-hidden',
        (!readOnly && !draftBox && !isPanning && !isSpaceDown) ? 'cursor-crosshair' : (isPanning || isSpaceDown ? 'cursor-grab' : 'cursor-default')
      )}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full block"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
      />

      {/* Popup tạo/chọn class khi vẽ xong mà chưa chọn class */}
      {draftBox && (
        <div 
          className="absolute z-20 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl p-3 w-56 flex flex-col gap-2 pointer-events-auto"
          style={{
            left: Math.min(draftBox.canvasRect.x + draftBox.canvasRect.w + 12, containerRef.current?.clientWidth - 230 || 0),
            top: Math.max(10, Math.min(draftBox.canvasRect.y, containerRef.current?.clientHeight - 150 || 0))
          }}
        >
          <div className="text-xs font-semibold text-slate-300 mb-1">Gán nhãn Box</div>
          <input 
            autoFocus
            type="text"
            placeholder="Tìm hoặc tạo class..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (searchText.trim()) {
                  onAnnotationCreate?.({ ...draftBox, className: searchText.trim() });
                } else if (selectedClassId) {
                  onAnnotationCreate?.({ ...draftBox, class_id: selectedClassId });
                }
                setDraftBox(null);
              }
              if (e.key === 'Escape') setDraftBox(null);
            }}
            className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500 w-full"
          />
          <div className="max-h-32 overflow-y-auto flex flex-col gap-1 mt-1">
            {classes.filter(c => c.name.toLowerCase().includes(searchText.toLowerCase())).map(c => (
              <button 
                key={c.id} 
                onClick={() => { 
                  onAnnotationCreate?.({ ...draftBox, class_id: c.id });
                  setDraftBox(null);
                }}
                className={cn(
                  "text-left text-xs px-2 py-1.5 rounded transition-colors flex items-center justify-between",
                  selectedClassId === c.id ? "bg-blue-500/20 text-blue-300" : "text-slate-300 hover:bg-slate-700"
                )}
              >
                <span>{c.name}</span>
                {selectedClassId === c.id && <span className="text-[10px] bg-blue-500/30 px-1 rounded">Selected</span>}
              </button>
            ))}
            {searchText.trim() && !classes.find(c => c.name.toLowerCase() === searchText.trim().toLowerCase()) && (
              <button 
                onClick={() => {
                  onAnnotationCreate?.({ ...draftBox, className: searchText.trim() });
                  setDraftBox(null);
                }}
                className="text-left text-xs text-blue-400 hover:bg-slate-700 px-2 py-1.5 rounded transition-colors font-medium"
              >
                + Tạo class "{searchText.trim()}"
              </button>
            )}
          </div>
          <button 
            onClick={() => setDraftBox(null)}
            className="text-xs text-slate-500 hover:text-slate-300 text-center mt-1"
          >
            Hủy (Esc)
          </button>
        </div>
      )}

      {!imageLoaded && imageUrl && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        </div>
      )}

      {!imageUrl && (
        <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm pointer-events-none">
          Chọn một ảnh để bắt đầu gán nhãn
        </div>
      )}

      {/* Hướng dẫn và Zoom control */}
      {!readOnly && imageLoaded && (
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[10px] text-slate-500 pointer-events-none">
          <span>Kéo chuột vẽ box • Giữ Space (hoặc chuột giữa) kéo để Pan • Lăn chuột để Zoom</span>
          <div className="pointer-events-auto flex items-center gap-3 bg-slate-900/90 border border-slate-700/50 rounded-lg px-2.5 py-1 backdrop-blur-md">
            <button 
              onClick={() => setViewportZoom(z => Math.max(0.5, z - 0.1))}
              className="hover:text-white p-0.5"
            >
              -
            </button>
            <span className="font-medium text-slate-300 min-w-[36px] text-center">
              {Math.round(viewportZoom * 100)}%
            </span>
            <button 
              onClick={() => setViewportZoom(z => Math.min(10, z + 0.1))}
              className="hover:text-white p-0.5"
            >
              +
            </button>
            <div className="w-px h-3 bg-slate-700 mx-0.5"></div>
            <button 
              onClick={() => { setViewportZoom(1); setViewportPan({ x: 0, y: 0 }); }}
              className="font-semibold text-blue-400 hover:text-blue-300"
            >
              RESET
            </button>
          </div>
          <span>{annotations.length} annotations</span>
        </div>
      )}
    </div>
  );
};

export default AnnotationCanvas;
