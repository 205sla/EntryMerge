import React, { useState } from 'react';

interface FileUploadProps {
  onFileUpload: (files: File[]) => void;
  uploadedFiles: File[];
}

export function FileUpload({ onFileUpload, uploadedFiles }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  
  const handleMerge = async () => {
    const formData = new FormData();
    uploadedFiles.forEach(file => {
      formData.append('files', file);
    });
    
    try {
      const response = await fetch('/api/merge', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) throw new Error('파일 결합 실패');
      
      // 파일 다운로드
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'merged.ent';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      
    } catch (error) {
      console.error('파일 결합 중 오류:', error);
    }
  };

  // JSX에 버튼 추가
  return (
    <div>
      {/* ... 기존 JSX ... */}
      {uploadedFiles.length > 1 && (
        <button 
          onClick={handleMerge}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          파일 결합
        </button>
      )}
    </div>
  );
} 