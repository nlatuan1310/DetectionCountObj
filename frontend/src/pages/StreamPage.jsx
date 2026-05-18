import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Wifi, WifiOff, Eye, EyeOff, Pencil, Trash2, FlipHorizontal, Settings, X } from 'lucide-react';
import SpotlightCard from '../components/ui/SpotlightCard';
import GlowButton from '../components/ui/GlowButton';
import useVideoStream from '../hooks/useVideoStream';
import { connectCamera, disconnectCamera } from '../services/camera_service';
import { cn } from '../utils/cn';

// ── Drawing modes ──
const DRAW_MODES = {
  NONE: 'none',
  ROI: 'roi',
  COUNTING_LINE: 'counting_line',
  WARNING_LINE: 'warning_line',
};

const StreamPage = () => {
  // ── Camera connection ──
  const [cameraIp, setCameraIp] = useState('');
  const [cameraUser, setCameraUser] = useState('admin');
  const [cameraPass, setCameraPass] = useState('');
  const [cameraConnected, setCameraConnected] = useState(false);
  const [connectLoading, setConnectLoading] = useState(false);
  const [connectError, setConnectError] = useState('');

  // ── Inference controls ──
  const [inferenceEnabled, setInferenceEnabled] = useState(true);

  // ── Settings Modal ──
  const [showSettings, setShowSettings] = useState(false);

  // ── Drawing state ──
  const [drawMode, setDrawMode] = useState(DRAW_MODES.NONE);
  const [roiPoints, setRoiPoints] = useState([]);
  const [countingLine, setCountingLine] = useState(null);
  const [warningLine, setWarningLine] = useState(null);
  const [warningFlip, setWarningFlip] = useState(false);
  const [tempPoints, setTempPoints] = useState([]);

  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  // ── WebSocket hook ──
  const { isConnected, stats, imgRef, connect: wsConnect, disconnect: wsDisconnect, sendConfig } = useVideoStream();

  // ── Camera connect/disconnect ──
  const handleConnect = async () => {
    if (!cameraIp.trim()) { setConnectError('Vui lòng nhập IP camera'); return; }
    if (!cameraPass.trim()) { setConnectError('Vui lòng nhập mật khẩu'); return; }
    setConnectLoading(true);
    setConnectError('');
    try {
      const result = await connectCamera(cameraIp, cameraUser, cameraPass);
      if (result.is_connected) {
        setCameraConnected(true);
        // Mở WebSocket sau khi camera kết nối thành công
        wsConnect();
      } else {
        setConnectError(result.error || 'Kết nối thất bại');
      }
    } catch (err) {
      setConnectError(err.response?.data?.detail || err.message || 'Lỗi kết nối');
    } finally {
      setConnectLoading(false);
    }
  };

  const handleDisconnect = async () => {
    // Đóng WebSocket trước
    wsDisconnect();
    try {
      await disconnectCamera();
    } catch (err) { /* ignore */ }
    setCameraConnected(false);
    setRoiPoints([]);
    setCountingLine(null);
    setWarningLine(null);
    setWarningFlip(false);
  };

  // ── Toggle inference ──
  const handleToggleInference = useCallback(() => {
    const next = !inferenceEnabled;
    setInferenceEnabled(next);
    sendConfig({ type: 'toggle_inference', value: next });
  }, [inferenceEnabled, sendConfig]);

  // ── Drag state cho chỉnh sửa line ──
  const [dragging, setDragging] = useState(null); // { type: 'counting'|'warning', pointIndex: 0|1 }

  // ── Canvas drawing logic ──
  const getCanvasCoords = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
  }, []);

  // Kiểm tra xem click có gần endpoint nào không (threshold 15px)
  const findNearEndpoint = useCallback((coords) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const threshold = 15 / canvas.getBoundingClientRect().width; // ~15px

    const checkLine = (line, type) => {
      if (!line) return null;
      for (let i = 0; i < 2; i++) {
        const dx = coords.x - line[i].x;
        const dy = coords.y - line[i].y;
        if (Math.sqrt(dx * dx + dy * dy) < threshold) {
          return { type, pointIndex: i };
        }
      }
      return null;
    };

    return checkLine(countingLine, 'counting') || checkLine(warningLine, 'warning');
  }, [countingLine, warningLine]);

  const handleCanvasMouseDown = useCallback((e) => {
    if (drawMode !== DRAW_MODES.NONE) return;
    const coords = getCanvasCoords(e);
    if (!coords) return;

    const hit = findNearEndpoint(coords);
    if (hit) {
      e.preventDefault();
      setDragging(hit);
    }
  }, [drawMode, getCanvasCoords, findNearEndpoint]);

  const handleCanvasMouseMove = useCallback((e) => {
    if (!dragging) return;
    const coords = getCanvasCoords(e);
    if (!coords) return;

    if (dragging.type === 'counting' && countingLine) {
      const newLine = [...countingLine];
      newLine[dragging.pointIndex] = coords;
      setCountingLine(newLine);
    } else if (dragging.type === 'warning' && warningLine) {
      const newLine = [...warningLine];
      newLine[dragging.pointIndex] = coords;
      setWarningLine(newLine);
    }
  }, [dragging, countingLine, warningLine, getCanvasCoords]);

  const handleCanvasMouseUp = useCallback(() => {
    if (dragging) {
      setDragging(null);
    }
  }, [dragging]);

  const handleCanvasClick = useCallback((e) => {
    if (dragging) return; // Không xử lý click khi đang drag
    if (drawMode === DRAW_MODES.NONE) return;
    const coords = getCanvasCoords(e);
    if (!coords) return;

    if (drawMode === DRAW_MODES.ROI) {
      setTempPoints((prev) => [...prev, coords]);
    } else if (drawMode === DRAW_MODES.COUNTING_LINE || drawMode === DRAW_MODES.WARNING_LINE) {
      setTempPoints((prev) => {
        const next = [...prev, coords];
        if (next.length >= 2) {
          const line = [next[0], next[1]];
          if (drawMode === DRAW_MODES.COUNTING_LINE) {
            setCountingLine(line);
          } else {
            setWarningLine(line);
          }
          setDrawMode(DRAW_MODES.NONE);
          return [];
        }
        return next;
      });
    }
  }, [drawMode, dragging, getCanvasCoords]);

  const handleCanvasDoubleClick = useCallback(() => {
    if (drawMode === DRAW_MODES.ROI && tempPoints.length >= 3) {
      setRoiPoints(tempPoints);
      setTempPoints([]);
      setDrawMode(DRAW_MODES.NONE);
    }
  }, [drawMode, tempPoints]);

  const handleCanvasRightClick = useCallback((e) => {
    e.preventDefault();
    if (drawMode !== DRAW_MODES.NONE) {
      setTempPoints([]);
      setDrawMode(DRAW_MODES.NONE);
    }
  }, [drawMode]);

  // ── Gửi zones tới backend ──
  const sendZones = useCallback(() => {
    sendConfig({
      type: 'zones',
      roi_points: roiPoints.length >= 3 ? roiPoints.map((p) => [p.x, p.y]) : null,
      counting_line: countingLine ? countingLine.map((p) => [p.x, p.y]) : null,
      warning_line: warningLine ? warningLine.map((p) => [p.x, p.y]) : null,
      warning_flip: warningFlip,
    });
  }, [roiPoints, countingLine, warningLine, warningFlip, sendConfig]);

  useEffect(() => {
    if (cameraConnected && (roiPoints.length > 0 || countingLine || warningLine)) {
      sendZones();
    }
  }, [roiPoints, countingLine, warningLine, warningFlip, cameraConnected, sendZones]);

  // ── Draw overlay on canvas ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const container = containerRef.current;
    if (!container) return;

    const w = container.offsetWidth;
    const h = container.offsetHeight;
    canvas.width = w;
    canvas.height = h;
    ctx.clearRect(0, 0, w, h);

    const drawPoints = (points, color, close = false) => {
      if (points.length < 1) return;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(points[0].x * w, points[0].y * h);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x * w, points[i].y * h);
      }
      if (close) ctx.closePath();
      ctx.stroke();
      // Draw points
      points.forEach((p) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(p.x * w, p.y * h, 4, 0, Math.PI * 2);
        ctx.fill();
      });
    };
    // Vẽ line đầy đủ + endpoint handles
    const drawLine = (line, color, label) => {
      if (!line || line.length < 2) return;
      // Line
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(line[0].x * w, line[0].y * h);
      ctx.lineTo(line[1].x * w, line[1].y * h);
      ctx.stroke();
      // Endpoint handles
      line.forEach((p) => {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x * w, p.y * h, 8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(p.x * w, p.y * h, 6, 0, Math.PI * 2);
        ctx.fill();
      });
      // Label
      if (label) {
        const mx = ((line[0].x + line[1].x) / 2) * w;
        const my = ((line[0].y + line[1].y) / 2) * h - 12;
        ctx.font = 'bold 13px Inter, sans-serif';
        // Text shadow
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillText(label, mx - 1, my + 1);
        ctx.fillStyle = color;
        ctx.fillText(label, mx, my);
      }
    };

    // Vẽ warning line + mũi tên chỉ hướng
    const drawWarningLine = (line, hasWarnings) => {
      if (!line || line.length < 2) return;
      const color = hasWarnings ? '#ff2222' : '#ff8800';
      drawLine(line, color, '⚠ Warning');

      // Mũi tên vuông góc ở giữa, chỉ hướng warning
      const mx = ((line[0].x + line[1].x) / 2) * w;
      const my = ((line[0].y + line[1].y) / 2) * h;
      const dx = (line[1].x - line[0].x) * w;
      const dy = (line[1].y - line[0].y) * h;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      // Normal vector (vuông góc)
      let nx = -dy / len;
      let ny = dx / len;
      if (warningFlip) { nx = -nx; ny = -ny; }
      const arrowLen = 35;
      const tipX = mx + nx * arrowLen;
      const tipY = my + ny * arrowLen;
      // Arrow body
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(mx, my);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();
      // Arrow head
      const headLen = 12;
      const angle = Math.atan2(ny, nx);
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(tipX - headLen * Math.cos(angle - 0.4), tipY - headLen * Math.sin(angle - 0.4));
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(tipX - headLen * Math.cos(angle + 0.4), tipY - headLen * Math.sin(angle + 0.4));
      ctx.stroke();
    };

    // Vẽ ROI
    if (roiPoints.length >= 3) {
      ctx.fillStyle = 'rgba(0, 255, 255, 0.08)';
      ctx.beginPath();
      ctx.moveTo(roiPoints[0].x * w, roiPoints[0].y * h);
      roiPoints.forEach((p) => ctx.lineTo(p.x * w, p.y * h));
      ctx.closePath();
      ctx.fill();
      drawPoints(roiPoints, '#00ffff', true);
    }

    // Vẽ temp points
    if (tempPoints.length > 0) {
      drawPoints(tempPoints, drawMode === DRAW_MODES.ROI ? '#00ffff' : '#ff6b6b');
      if (drawMode === DRAW_MODES.ROI && tempPoints.length >= 2) {
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(tempPoints[tempPoints.length - 1].x * w, tempPoints[tempPoints.length - 1].y * h);
        ctx.lineTo(tempPoints[0].x * w, tempPoints[0].y * h);
        ctx.stroke();
      }
    }

    // Counting line + label count
    if (countingLine) {
      drawLine(countingLine, '#00ff88', `Count: ${stats.crossing_total || 0}`);
    }

    // Warning line + mũi tên
    drawWarningLine(warningLine, stats.warnings?.length > 0);
  }, [roiPoints, countingLine, warningLine, warningFlip, tempPoints, drawMode, stats.crossing_total, stats.warnings]);

  return (
    <div className="space-y-4 h-full flex flex-col relative">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Live Camera Stream</h2>
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-2.5 h-2.5 rounded-full",
            isConnected ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" : "bg-slate-600"
          )} />
          <span className="text-sm text-slate-400">{isConnected ? 'WS Connected' : 'WS Disconnected'}</span>
        </div>
      </div>

      <div className={cn("flex-1 grid gap-4 min-h-0", cameraConnected ? "grid-cols-1 lg:grid-cols-[1fr_320px]" : "grid-cols-1")}>
        {/* ═══ VIDEO PANEL ═══ */}
        <div
          ref={containerRef}
          className="relative bg-slate-950/80 backdrop-blur-xl border border-slate-800 rounded-2xl overflow-hidden group min-h-[400px]"
        >
          {/* Video frame */}
          <img
            ref={imgRef}
            alt="Camera Stream"
            className="absolute inset-0 w-full h-full object-contain bg-black"
            style={{ display: cameraConnected ? 'block' : 'none' }}
          />

          {/* Canvas overlay for drawing & editing */}
          <canvas
            ref={canvasRef}
            className={cn(
              "absolute inset-0 w-full h-full z-10",
              drawMode !== DRAW_MODES.NONE
                ? "cursor-crosshair"
                : dragging
                  ? "cursor-grabbing"
                  : (countingLine || warningLine)
                    ? "cursor-default"
                    : "pointer-events-none"
            )}
            onClick={handleCanvasClick}
            onDoubleClick={handleCanvasDoubleClick}
            onContextMenu={handleCanvasRightClick}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
          />

          {/* Connection Form (Waiting state) */}
          {!cameraConnected && (
            <div className="absolute inset-0 flex items-center justify-center z-20 bg-slate-900/40 backdrop-blur-sm p-4">
              <div className="bg-slate-900 border border-slate-700 p-8 rounded-2xl shadow-2xl w-full max-w-sm">
                <div className="flex items-center justify-center mb-6">
                  <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
                    <Wifi size={24} className="text-blue-400" />
                  </div>
                </div>
                <h3 className="text-xl font-bold text-white mb-6 text-center">Kết nối Camera</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5 ml-1">IP Camera</label>
                    <input
                      type="text"
                      placeholder="VD: 192.168.1.64"
                      value={cameraIp}
                      onChange={(e) => setCameraIp(e.target.value)}
                      className="w-full bg-slate-800/60 border border-slate-700/50 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500/50 transition-colors text-white placeholder:text-slate-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5 ml-1">Username</label>
                    <input
                      type="text"
                      placeholder="admin"
                      value={cameraUser}
                      onChange={(e) => setCameraUser(e.target.value)}
                      className="w-full bg-slate-800/60 border border-slate-700/50 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500/50 transition-colors text-white placeholder:text-slate-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5 ml-1">Mật khẩu</label>
                    <input
                      type="password"
                      placeholder="Nhập mật khẩu"
                      value={cameraPass}
                      onChange={(e) => setCameraPass(e.target.value)}
                      className="w-full bg-slate-800/60 border border-slate-700/50 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500/50 transition-colors text-white placeholder:text-slate-600"
                    />
                  </div>
                  {connectError && <p className="text-xs text-red-400 text-center font-medium">{connectError}</p>}
                  <GlowButton variant="blue" className="w-full mt-4 py-3" onClick={handleConnect} disabled={connectLoading}>
                    {connectLoading ? 'Đang kết nối...' : 'Kết nối'}
                  </GlowButton>
                </div>
              </div>
            </div>
          )}

          {/* Draw mode indicator */}
          {drawMode !== DRAW_MODES.NONE && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-black/80 backdrop-blur-md px-5 py-2.5 rounded-full border border-blue-500/30 text-sm shadow-xl flex items-center gap-3">
              <span className="text-blue-400 font-medium whitespace-nowrap">
                {drawMode === DRAW_MODES.ROI && '🎯 Vẽ ROI — Click để thêm điểm, Double-click để hoàn tất'}
                {drawMode === DRAW_MODES.COUNTING_LINE && '📏 Vẽ Counting Line — Click 2 điểm'}
                {drawMode === DRAW_MODES.WARNING_LINE && '⚠️ Vẽ Warning Line — Click 2 điểm'}
              </span>
              <div className="w-px h-4 bg-slate-700" />
              <span className="text-slate-400 text-xs whitespace-nowrap">Chuột phải để hủy</span>
            </div>
          )}

          {/* Bottom overlay */}
          {cameraConnected && (
            <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity z-20">
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2 bg-black/40 backdrop-blur px-3 py-1.5 rounded-lg border border-white/10">
                  <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(239,68,68,1)]" />
                  <span className="font-semibold text-white tracking-wider text-xs">LIVE</span>
                </div>
                <span className="text-slate-300 ml-auto font-mono bg-black/40 backdrop-blur px-3 py-1.5 rounded-lg border border-white/10">
                  Display: <span className="text-white">{stats.display_fps || 0}</span> FPS &bull; AI: <span className="text-blue-400">{stats.inference_fps || 0}</span> FPS
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ═══ CONTROL PANEL ═══ */}
        {cameraConnected && (
          <div className="flex flex-col gap-4 overflow-y-auto pr-1">
            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowSettings(true)}
                className="py-3 text-sm font-semibold bg-slate-800/80 hover:bg-slate-700/80 text-white border border-slate-700/50 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-sm"
              >
                <Settings size={18} className="text-blue-400" /> Cài đặt
              </button>
              <button
                onClick={handleDisconnect}
                className="py-3 text-sm font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-sm"
              >
                <WifiOff size={18} /> Ngắt kết nối
              </button>
            </div>

            {/* Stats */}
            <SpotlightCard>
              <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                <span className="text-lg">📊</span> Thống kê
              </h3>
              <div className="space-y-4">
                <div className="flex flex-col gap-1 bg-emerald-500/10 px-4 py-3 rounded-xl border border-emerald-500/20">
                  <span className="text-emerald-400/80 text-xs font-medium uppercase tracking-wider">Đã qua vạch</span>
                  <span className="text-emerald-400 font-mono font-bold text-3xl leading-none">
                    {stats.crossing_total || 0}
                  </span>
                </div>
                {/* Class counts */}
                {stats.class_counts && Object.keys(stats.class_counts).length > 0 && (
                  <div className="pt-2">
                    <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Chi tiết sản phẩm</h4>
                    <div className="space-y-2">
                      {Object.entries(stats.class_counts).map(([name, count]) => (
                        <div key={name} className="flex justify-between text-sm items-center px-1">
                          <span className="text-slate-300 truncate mr-2">{name}</span>
                          <span className="text-white font-mono font-semibold bg-slate-800/80 border border-slate-700 px-2.5 py-0.5 rounded-md min-w-[2rem] text-center">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* Warnings */}
                {stats.warnings && stats.warnings.length > 0 && (
                  <div className="pt-3 border-t border-red-500/20 space-y-2">
                    <h4 className="text-xs font-medium text-red-400/80 uppercase tracking-wider mb-1">Cảnh báo</h4>
                    {stats.warnings.slice(0, 3).map((w, i) => (
                      <p key={i} className="text-xs text-red-300 bg-red-500/15 px-3 py-2 rounded-lg border border-red-500/20 flex items-start gap-2 leading-relaxed">
                        <span className="text-base leading-none mt-0.5">⚠️</span> {w}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </SpotlightCard>
          </div>
        )}
      </div>

      {/* ═══ SETTINGS MODAL ═══ */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl shadow-2xl w-full max-w-sm relative animate-in fade-in zoom-in-95 duration-200">
            <button 
              onClick={() => setShowSettings(false)}
              className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors bg-slate-800/50 hover:bg-slate-700 p-1.5 rounded-lg"
            >
              <X size={18} />
            </button>
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <Settings size={20} className="text-blue-400" />
              Cài đặt & Công cụ
            </h3>
            
            <div className="space-y-6">
              {/* AI Inference Toggle */}
              <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Trạng thái AI</h4>
                <button
                  onClick={handleToggleInference}
                  className={cn(
                    "w-full py-3 text-sm font-semibold rounded-xl border transition-all flex items-center justify-center gap-2",
                    inferenceEnabled
                      ? "bg-blue-500/15 text-blue-400 border-blue-500/30 hover:bg-blue-500/25 shadow-[0_0_15px_rgba(59,130,246,0.15)]"
                      : "bg-slate-800/50 text-slate-400 border-slate-700/50 hover:bg-slate-700/50"
                  )}
                >
                  {inferenceEnabled ? <Eye size={18} /> : <EyeOff size={18} />}
                  {inferenceEnabled ? 'AI Đang Bật' : 'AI Đang Tắt'}
                </button>
              </div>

              {/* Drawing Tools */}
              <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Công cụ vẽ</h4>
                <div className="grid grid-cols-1 gap-2.5">
                  <button
                    onClick={() => { setDrawMode(DRAW_MODES.ROI); setTempPoints([]); setShowSettings(false); }}
                    className={cn(
                      "py-2.5 text-sm font-medium rounded-xl border transition-all flex items-center justify-center gap-2",
                      drawMode === DRAW_MODES.ROI
                        ? "bg-cyan-500/15 text-cyan-400 border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.15)]"
                        : "bg-slate-800/40 text-slate-300 border-slate-700/50 hover:bg-slate-700/50"
                    )}
                  >
                    🎯 Vẽ ROI Polygon
                  </button>
                  <button
                    onClick={() => { setDrawMode(DRAW_MODES.COUNTING_LINE); setTempPoints([]); setShowSettings(false); }}
                    className={cn(
                      "py-2.5 text-sm font-medium rounded-xl border transition-all flex items-center justify-center gap-2",
                      drawMode === DRAW_MODES.COUNTING_LINE
                        ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                        : "bg-slate-800/40 text-slate-300 border-slate-700/50 hover:bg-slate-700/50"
                    )}
                  >
                    📏 Vẽ Counting Line
                  </button>
                  <button
                    onClick={() => { setDrawMode(DRAW_MODES.WARNING_LINE); setTempPoints([]); setShowSettings(false); }}
                    className={cn(
                      "py-2.5 text-sm font-medium rounded-xl border transition-all flex items-center justify-center gap-2",
                      drawMode === DRAW_MODES.WARNING_LINE
                        ? "bg-red-500/15 text-red-400 border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.15)]"
                        : "bg-slate-800/40 text-slate-300 border-slate-700/50 hover:bg-slate-700/50"
                    )}
                  >
                    ⚠️ Vẽ Warning Line
                  </button>

                  {/* Actions */}
                  {warningLine && (
                    <button
                      onClick={() => { setWarningFlip(!warningFlip); }}
                      className="py-2.5 mt-2 text-sm font-medium rounded-xl border bg-orange-500/10 text-orange-400 border-orange-500/20 hover:bg-orange-500/20 transition-all flex items-center justify-center gap-2"
                    >
                      <FlipHorizontal size={16} /> Lật hướng Warning
                    </button>
                  )}
                  {(roiPoints.length > 0 || countingLine || warningLine) && (
                    <button
                      onClick={() => { setRoiPoints([]); setCountingLine(null); setWarningLine(null); setWarningFlip(false); sendConfig({ type: 'zones', roi_points: null, counting_line: null, warning_line: null, warning_flip: false }); }}
                      className="py-2.5 mt-2 text-sm font-medium rounded-xl border bg-slate-800/50 text-slate-400 border-slate-700/50 hover:bg-red-500/15 hover:text-red-400 hover:border-red-500/30 transition-all flex items-center justify-center gap-2"
                    >
                      <Trash2 size={16} /> Xóa tất cả hình vẽ
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StreamPage;
