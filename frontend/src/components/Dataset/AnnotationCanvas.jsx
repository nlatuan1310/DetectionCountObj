import React, { useRef, useState, useEffect, useCallback } from 'react';
import { cn } from '../../utils/cn';
import { getClassColor } from '../../utils/colors';
import { MousePointer2, Hand, X } from 'lucide-react';

/**
 * AnnotationCanvas — Canvas HTML5 để vẽ bounding box annotation.
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
  onAnnotationFocus,
  readOnly = false,
}) => {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  // Tool Modes
  const [interactionMode, setInteractionMode] = useState('draw'); // 'draw' | 'pan'

  // Zoom & Pan states
  const [viewportZoom, setViewportZoom] = useState(1);
  const [viewportPan, setViewportPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState(null);
  const [isSpaceDown, setIsSpaceDown] = useState(false);

  // Common UI states
  const [mousePos, setMousePos] = useState(null);
  const [hoveredAnnotation, setHoveredAnnotation] = useState(null);

  // Draw Mode states
  const [drawing, setDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState(null);
  const [currentPoint, setCurrentPoint] = useState(null);
  const [draftBox, setDraftBox] = useState(null);
  const [searchText, setSearchText] = useState('');

  // Resize/Edit states (Hand Mode)
  const [resizing, setResizing] = useState(null); // { annId, handle, startPos, startRect }
  const [editingBox, setEditingBox] = useState(null); // { ann, canvasRect }
  const [editSearchText, setEditSearchText] = useState('');

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

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => {
      if (imageLoaded) calculateFit();
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [imageLoaded, calculateFit]);

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

  const getHandleAtPos = useCallback((x, y, rect) => {
    const s = 6;
    if (Math.abs(x - rect.x) <= s && Math.abs(y - rect.y) <= s) return 'nw';
    if (Math.abs(x - (rect.x + rect.w)) <= s && Math.abs(y - rect.y) <= s) return 'ne';
    if (Math.abs(x - rect.x) <= s && Math.abs(y - (rect.y + rect.h)) <= s) return 'sw';
    if (Math.abs(x - (rect.x + rect.w)) <= s && Math.abs(y - (rect.y + rect.h)) <= s) return 'se';
    if (Math.abs(x - rect.x) <= s && y > rect.y && y < rect.y + rect.h) return 'w';
    if (Math.abs(x - (rect.x + rect.w)) <= s && y > rect.y && y < rect.y + rect.h) return 'e';
    if (Math.abs(y - rect.y) <= s && x > rect.x && x < rect.x + rect.w) return 'n';
    if (Math.abs(y - (rect.y + rect.h)) <= s && x > rect.x && x < rect.x + rect.w) return 's';
    return null;
  }, []);

  const currentAnnotations = resizing ? annotations.filter(a => a.id !== resizing.annId) : annotations;
  let activeAnnId = null;
  if (interactionMode === 'pan') {
    activeAnnId = hoveredAnnotation || focusedAnnotationId;
  } else {
    activeAnnId = focusedAnnotationId;
  }

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

    // Vẽ draftBox (đang chờ chọn class lúc vẽ)
    if (draftBox && !drawing) {
      const { x, y, w, h } = draftBox.canvasRect;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);
    }

    const drawAnnotation = (ann, forceHover = false, customRect = null) => {
      const annRect = customRect || yoloToCanvas(ann);
      const color = getClassColor(ann.class_id);
      const isHovered = forceHover || activeAnnId === ann.id;

      ctx.strokeStyle = color;
      ctx.lineWidth = isHovered ? 2.5 : 2;
      ctx.strokeRect(annRect.x, annRect.y, annRect.w, annRect.h);

      if (isHovered && interactionMode === 'pan' && !resizing) {
        const handleSize = 8;
        ctx.fillStyle = color;
        const pts = [
          { x: annRect.x, y: annRect.y },
          { x: annRect.x + annRect.w, y: annRect.y },
          { x: annRect.x, y: annRect.y + annRect.h },
          { x: annRect.x + annRect.w, y: annRect.y + annRect.h },
          { x: annRect.x + annRect.w / 2, y: annRect.y },
          { x: annRect.x + annRect.w / 2, y: annRect.y + annRect.h },
          { x: annRect.x, y: annRect.y + annRect.h / 2 },
          { x: annRect.x + annRect.w, y: annRect.y + annRect.h / 2 },
        ];
        pts.forEach(c => {
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

    // Vẽ các annotation không focus trước
    currentAnnotations.forEach((ann) => {
      if (ann.id !== activeAnnId) {
        drawAnnotation(ann);
      }
    });

    // Dimming effect và vẽ annotation focus/hovered lên trên
    if (activeAnnId || resizing) {
      const focusTarget = resizing ? annotations.find(a => a.id === resizing.annId) : annotations.find(a => a.id === activeAnnId);
      
      if (focusTarget) {
        const rect = resizing ? resizing.currentRect : yoloToCanvas(focusTarget);
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.beginPath();
        ctx.rect(effOffsetX, effOffsetY, renderW, renderH);
        ctx.rect(rect.x, rect.y, rect.w, rect.h);
        ctx.fill('evenodd');

        drawAnnotation(focusTarget, true, rect);
      }
    }

    if (drawing && startPoint && currentPoint) {
      const color = '#ffffff';
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

    // Crosshair (Draw mode only)
    if (mousePos && !readOnly && interactionMode === 'draw' && !draftBox) {
      const color = '#ffffff';
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
    imageLoaded, imageDimensions, scale, offset, currentAnnotations, viewportZoom, viewportPan,
    drawing, startPoint, currentPoint, mousePos, hoveredAnnotation, focusedAnnotationId,
    selectedClassId, draftBox, yoloToCanvas, getClassColor, getClassName, readOnly, interactionMode, activeAnnId, resizing, annotations
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
      if (e.code === 'Space' && !draftBox && !editingBox && document.activeElement.tagName !== 'INPUT') {
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
  }, [draftBox, editingBox]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onWheel = (e) => {
      e.preventDefault();
      
      // Zoom vào vị trí con trỏ chuột (giống Roboflow)
      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const delta = e.deltaY < 0 ? 0.1 : -0.1;
      setViewportZoom((prevZoom) => {
        let newZoom = prevZoom * (1 + delta);
        newZoom = Math.max(0.5, Math.min(newZoom, 10));
        
        setViewportPan((prevPan) => {
          const imageX = (mouseX - offset.x - prevPan.x) / (scale * prevZoom);
          const imageY = (mouseY - offset.y - prevPan.y) / (scale * prevZoom);
          return {
            x: mouseX - offset.x - imageX * (scale * newZoom),
            y: mouseY - offset.y - imageY * (scale * newZoom)
          };
        });
        return newZoom;
      });
    };

    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, [offset, scale]);

  const handleMouseDown = (e) => {
    if (readOnly || draftBox || editingBox) return; 
    const pos = getCanvasPos(e);

    // Xử lý Pan (Middle click hoặc Space)
    if (e.button === 1 || isSpaceDown) {
      setIsPanning(true);
      setPanStart({ ...pos, panX: viewportPan.x, panY: viewportPan.y });
      return;
    }
    
    if (interactionMode === 'pan') {
      // Kiểm tra có resize/move box nào không
      if (activeAnnId) {
        const ann = annotations.find(a => a.id === activeAnnId);
        if (ann) {
          const rect = yoloToCanvas(ann);
          const handle = getHandleAtPos(pos.x, pos.y, rect);
          if (handle) {
            setResizing({
              annId: ann.id,
              handle,
              startPos: pos,
              startRect: rect,
              currentRect: rect
            });
            return;
          }
        }
      }
      
      // Nếu click vào box thì set editingBox
      if (hoveredAnnotation) {
        const ann = annotations.find(a => a.id === hoveredAnnotation);
        onAnnotationFocus?.(ann.id);
        const rect = yoloToCanvas(ann);
        setEditingBox({ ann, canvasRect: rect });
        setEditSearchText('');
        return;
      } else {
        onAnnotationFocus?.(null);
      }

      // Pan (nếu không click trúng gì)
      setIsPanning(true);
      setPanStart({ ...pos, panX: viewportPan.x, panY: viewportPan.y });
      return;
    }

    // Draw mode
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

    if (isPanning && panStart) {
      setViewportPan({
        x: panStart.panX + (pos.x - panStart.x),
        y: panStart.panY + (pos.y - panStart.y)
      });
      return;
    }

    if (resizing) {
      const dx = pos.x - resizing.startPos.x;
      const dy = pos.y - resizing.startPos.y;
      let { x, y, w, h } = resizing.startRect;

      if (resizing.handle === 'se') { w += dx; h += dy; }
      if (resizing.handle === 'sw') { x += dx; w -= dx; h += dy; }
      if (resizing.handle === 'ne') { y += dy; w += dx; h -= dy; }
      if (resizing.handle === 'nw') { x += dx; y += dy; w -= dx; h -= dy; }
      if (resizing.handle === 'e') { w += dx; }
      if (resizing.handle === 'w') { x += dx; w -= dx; }
      if (resizing.handle === 's') { h += dy; }
      if (resizing.handle === 'n') { y += dy; h -= dy; }

      // Clamp
      const effScale = scale * viewportZoom;
      const effOffsetX = offset.x + viewportPan.x;
      const effOffsetY = offset.y + viewportPan.y;
      const maxW = imageDimensions.width * effScale;
      const maxH = imageDimensions.height * effScale;

      if (w < 10) w = 10;
      if (h < 10) h = 10;
      
      setResizing({
        ...resizing,
        currentRect: { x, y, w, h }
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

    // Hover logic
    if (interactionMode === 'pan' && !draftBox && !editingBox) {
      let found = null;
      let cursor = 'grab';

      // Check resize handles first if there is an active annotation
      if (activeAnnId) {
        const ann = annotations.find(a => a.id === activeAnnId);
        if (ann) {
          const rect = yoloToCanvas(ann);
          const handle = getHandleAtPos(pos.x, pos.y, rect);
          if (handle) {
            found = ann.id;
            if (handle === 'nw' || handle === 'se') cursor = 'nwse-resize';
            else if (handle === 'ne' || handle === 'sw') cursor = 'nesw-resize';
            else if (handle === 'n' || handle === 's') cursor = 'ns-resize';
            else if (handle === 'e' || handle === 'w') cursor = 'ew-resize';
          }
        }
      }

      if (!found) {
        for (let i = annotations.length - 1; i >= 0; i--) {
          const ann = annotations[i];
          const rect = yoloToCanvas(ann);
          if (
            pos.x >= rect.x && pos.x <= rect.x + rect.w &&
            pos.y >= rect.y && pos.y <= rect.y + rect.h
          ) {
            found = ann.id;
            cursor = 'pointer';
            break;
          }
        }
      }
      
      setHoveredAnnotation(found);
      if (canvasRef.current) canvasRef.current.style.cursor = found ? cursor : 'grab';
    } else {
      setHoveredAnnotation(null);
      if (canvasRef.current) canvasRef.current.style.cursor = (isSpaceDown || isPanning) ? 'grabbing' : 'crosshair';
    }
  };

  const handleMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
      setPanStart(null);
      return;
    }

    if (resizing) {
      const bbox = canvasToYolo(
        resizing.currentRect.x,
        resizing.currentRect.y,
        resizing.currentRect.x + resizing.currentRect.w,
        resizing.currentRect.y + resizing.currentRect.h
      );
      if (bbox) {
        onAnnotationUpdate?.(resizing.annId, bbox);
      }
      setResizing(null);
      return;
    }

    if (drawing && startPoint && currentPoint) {
      const bbox = canvasToYolo(startPoint.x, startPoint.y, currentPoint.x, currentPoint.y);
      if (bbox) {
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
      return;
    }

    setDrawing(false);
    setStartPoint(null);
    setCurrentPoint(null);
  };

  const handleMouseLeave = () => {
    setDrawing(false); 
    setIsPanning(false);
    setResizing(null);
    setStartPoint(null);
    setPanStart(null);
    setHoveredAnnotation(null);
    setMousePos(null);
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-[400px] bg-[#0c0d12] rounded-xl overflow-hidden"
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full block"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onContextMenu={handleContextMenu}
      />

      {/* Popup tạo class (Draw mode) */}
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

      {/* Popup sửa class (Pan mode) */}
      {editingBox && (
        <div 
          className="absolute z-20 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl p-3 w-56 flex flex-col gap-2 pointer-events-auto"
          style={{
            left: Math.min(editingBox.canvasRect.x + editingBox.canvasRect.w + 12, containerRef.current?.clientWidth - 230 || 0),
            top: Math.max(10, Math.min(editingBox.canvasRect.y, containerRef.current?.clientHeight - 150 || 0))
          }}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-slate-300">Sửa class</span>
            <button onClick={() => setEditingBox(null)} className="text-slate-500 hover:text-white">
              <X size={14} />
            </button>
          </div>
          <input 
            autoFocus
            type="text"
            placeholder="Tìm hoặc đổi class..."
            value={editSearchText}
            onChange={(e) => setEditSearchText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && editSearchText.trim() && !classes.find(c => c.name.toLowerCase() === editSearchText.trim().toLowerCase())) {
                onAnnotationUpdate?.(editingBox.ann.id, { className: editSearchText.trim() });
                setEditingBox(null);
              }
              if (e.key === 'Escape') setEditingBox(null);
            }}
            className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500 w-full"
          />
          <div className="max-h-32 overflow-y-auto flex flex-col gap-1 mt-1">
            {classes.filter(c => c.name.toLowerCase().includes(editSearchText.toLowerCase())).map(c => (
              <button 
                key={c.id} 
                onClick={() => { 
                  onAnnotationUpdate?.(editingBox.ann.id, { class_id: c.id });
                  setEditingBox(null);
                }}
                className={cn(
                  "text-left text-xs px-2 py-1.5 rounded transition-colors flex items-center justify-between",
                  editingBox.ann.class_id === c.id ? "bg-blue-500/20 text-blue-300" : "text-slate-300 hover:bg-slate-700"
                )}
              >
                <span>{c.name}</span>
                {editingBox.ann.class_id === c.id && <span className="text-[10px] bg-blue-500/30 px-1 rounded">Current</span>}
              </button>
            ))}
            {editSearchText.trim() && !classes.find(c => c.name.toLowerCase() === editSearchText.trim().toLowerCase()) && (
              <button 
                onClick={() => {
                  onAnnotationUpdate?.(editingBox.ann.id, { className: editSearchText.trim() });
                  setEditingBox(null);
                }}
                className="text-left text-xs text-blue-400 hover:bg-slate-700 px-2 py-1.5 rounded transition-colors font-medium"
              >
                + Đổi thành "{editSearchText.trim()}"
              </button>
            )}
          </div>
          <button 
            onClick={() => {
              onAnnotationDelete?.(editingBox.ann.id);
              setEditingBox(null);
            }}
            className="text-xs text-red-400 hover:text-red-300 hover:bg-red-400/10 text-center py-1 mt-1 rounded"
          >
            Xóa Box Này
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

      {/* Toolbar và Controls */}
      {!readOnly && imageLoaded && (
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[10px] text-slate-500 pointer-events-none">
          <div className="flex items-center gap-2 pointer-events-auto">
            <div className="flex items-center bg-slate-900/90 border border-slate-700/50 rounded-lg p-1 backdrop-blur-md">
              <button
                onClick={() => { setInteractionMode('draw'); setEditingBox(null); }}
                className={cn(
                  "p-1.5 rounded flex items-center gap-1.5 transition-colors",
                  interactionMode === 'draw' ? "bg-blue-500/20 text-blue-400" : "text-slate-400 hover:text-white"
                )}
                title="Chế độ Vẽ (Draw)"
              >
                <MousePointer2 size={16} />
                <span className="font-medium px-1">Draw</span>
              </button>
              <button
                onClick={() => { setInteractionMode('pan'); setDraftBox(null); }}
                className={cn(
                  "p-1.5 rounded flex items-center gap-1.5 transition-colors",
                  interactionMode === 'pan' ? "bg-blue-500/20 text-blue-400" : "text-slate-400 hover:text-white"
                )}
                title="Chế độ Bàn tay (Pan/Select)"
              >
                <Hand size={16} />
                <span className="font-medium px-1">Hand</span>
              </button>
            </div>
            {interactionMode === 'draw' ? (
              <span>Kéo để vẽ • Lăn chuột để Zoom</span>
            ) : (
              <span>Kéo để Pan • Click box để Sửa • Kéo góc để Resize</span>
            )}
          </div>

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
        </div>
      )}
    </div>
  );
};

export default AnnotationCanvas;
