import React from 'react';

function formatSize(bytes) {
  if (bytes === 0) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${u[i]}`;
}

const STATUS_BADGE = {
  queued:    'bg-[#2a3060] text-[#8b92b8]',
  uploading: 'bg-blue-900/60 text-blue-300',
  uploaded:  'bg-emerald-900/60 text-emerald-300',
  failed:    'bg-red-900/60 text-red-300',
};

export default function FileItem({ file, onRemove }) {
  const { name, size, status, progress, error } = file;

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[#2a3060] bg-[#1a1e35] group">
      {/* Icon */}
      <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#141627] flex-shrink-0">
        <svg className="w-4 h-4 text-[#5c6290]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[#e8eaf6] truncate">{name}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${STATUS_BADGE[status]}`}>
            {status}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-[#5c6290]">{formatSize(size)}</span>
          {status === 'uploading' && (
            <span className="text-xs text-blue-400">{progress || 0}%</span>
          )}
        </div>

        {/* Progress bar */}
        {(status === 'uploading' || status === 'uploaded') && (
          <div className="w-full bg-[#141627] rounded-full h-1 mt-1.5">
            <div
              className={`h-1 rounded-full transition-all duration-300 ${
                status === 'uploaded' ? 'bg-emerald-500' : 'bg-[#4f7cff]'
              }`}
              style={{ width: status === 'uploaded' ? '100%' : `${progress || 0}%` }}
            />
          </div>
        )}

        {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
      </div>

      {/* Remove button */}
      {(status === 'queued' || status === 'failed') && (
        <button
          onClick={() => onRemove(file.id)}
          className="w-7 h-7 flex items-center justify-center text-[#5c6290] hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
