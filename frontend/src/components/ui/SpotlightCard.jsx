'use client'
import React from "react";

export default function SpotlightCard({ children, className }) {
  return (
    <>
      <style jsx>{`
        @property --border-angle {
          syntax: "<angle>";
          inherits: true;
          initial-value: 0deg;
        }

        @keyframes border-spin {
          100% {
            --border-angle: 360deg;
          }
        }

        .animate-border {
            animation: border-spin 6s linear infinite;
        }
      `}</style>
    <div className={`w-full flex items-center justify-center p-1 ${className || ''}`}>
      <div className="w-full h-full mx-auto [background:linear-gradient(45deg,#080b11,theme(colors.slate.800)_50%,#172033)_padding-box,conic-gradient(from_var(--border-angle),theme(colors.slate.600/.48)_80%,theme(colors.teal.500)_86%,theme(colors.cyan.300)_90%,theme(colors.teal.500)_94%,theme(colors.slate.600/.48))_border-box] rounded-2xl border border-transparent animate-border">
        <div className="relative z-10 p-6 rounded-2xl w-full bg-slate-900/80 backdrop-blur-md h-full mx-auto">
          {children}
        </div>
      </div>
    </div>
    </>
  );
}
