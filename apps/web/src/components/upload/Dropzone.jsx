import React, { useRef, useState } from 'react';

export default function Dropzone({ onFiles, onFilesSelected, disabled }) {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef(null);

  const handleDragOver = (e) => { if (disabled) return; e.preventDefault(); e.stopPropagation(); setIsDragOver(true); };
  const handleDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(false); };
  const handleDrop = (e) => {
    if (disabled) return;
    e.preventDefault(); e.stopPropagation(); setIsDragOver(false);
    const files = e.dataTransfer?.files;
    const cb = onFiles || onFilesSelected;
    if (files && files.length > 0 && cb) cb(Array.from(files));
  };
  const handleInputChange = (e) => {
    const cb = onFiles || onFilesSelected;
    const files = e.target.files;
    if (files && files.length > 0 && cb) cb(Array.from(files));
    e.target.value = '';
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative border-2 border-dashed rounded-xl py-14 px-8 text-center transition-all duration-200 select-none ${
        isDragOver ? 'border-[#4f7cff] bg-[#4f7cff]/8' : 'border-[#2a3060] hover:border-[#4f7cff]/50'
      }`}
    >
      <input ref={inputRef} type="file" multiple className="hidden" onChange={handleInputChange} />

      <div className="flex flex-col items-center gap-4">
        {/* Circular upload icon */}
        <div className={`w-14 h-14 rounded-full border-2 flex items-center justify-center transition-all ${
          isDragOver ? 'border-[#4f7cff] bg-[#4f7cff]/20' : 'border-[#3a4280] bg-[#1a1e35]'
        }`}>
          <svg className={`w-6 h-6 ${isDragOver ? 'text-[#4f7cff]' : 'text-[#8b92b8]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
        </div>

        <div>
          <p className="text-sm font-semibold text-[#e8eaf6]">Drop files here or click to browse</p>
          <p className="text-xs text-[#5c6290] mt-1">Supported formats: CSV, XLS, XLSX, JSON, TXT, PDF</p>
        </div>

        <button
          onClick={(e) => { if (disabled) return; e.stopPropagation(); inputRef.current?.click(); }}
          type="button"
          className="px-6 py-2 rounded-lg text-sm font-semibold text-white bg-[#4f7cff] hover:bg-[#3b63e6] transition-colors shadow-lg shadow-[#4f7cff]/20"
        >
          Select Files
        </button>
      </div>
    </div>
  );
}
