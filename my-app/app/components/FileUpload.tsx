'use client';

import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

export function FileUpload() {
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleFileUpload = (files: File[]) => {
    setUploadedFiles(prev => [...prev, ...files]);
  };

  const handleMerge = async () => {
    if (uploadedFiles.length < 2) return;
    
    setIsLoading(true);
    const formData = new FormData();
    uploadedFiles.forEach(file => {
      formData.append('files', file);
    });
    
    try {
      const response = await fetch('/api/merge', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '파일 결합 실패');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'merged.ent';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      
    } catch (error: unknown) {
      console.error('상세 에러:', error);
      const errorMessage = error instanceof Error ? error.message : '파일 결합 중 오류가 발생했습니다.';
      alert(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const entFiles = acceptedFiles.filter(file => file.name.endsWith('.ent'));
    if (entFiles.length > 0) {
      handleFileUpload(entFiles);
    }
  }, [handleFileUpload]);

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: {
      'application/x-ent': ['.ent']
    },
    multiple: true,
    onDragEnter: () => setIsDragging(true),
    onDragLeave: () => setIsDragging(false),
    onDragOver: () => setIsDragging(true)
  });

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`p-8 border-2 border-dashed rounded-lg text-center cursor-pointer 
          ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-500 hover:bg-blue-50'}`}
      >
        <input {...getInputProps()} className="hidden" />
        <p className="text-gray-600">
          .ent 파일을 드래그 앤 드롭하거나 클릭하여 업로드하세요
        </p>
      </div>

      {uploadedFiles.length > 0 && (
        <div className="mt-4">
          <h2 className="text-lg font-semibold mb-2">업로드된 파일:</h2>
          <ul className="space-y-2">
            {uploadedFiles.map((file, index) => (
              <li key={index} className="flex items-center gap-2">
                <span>{file.name}</span>
                <span className="text-sm text-gray-500">
                  ({(file.size / 1024 / 1024).toFixed(2)} MB)
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {uploadedFiles.length > 1 && (
        <button 
          onClick={handleMerge}
          disabled={isLoading}
          className={`mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed
            ${isLoading ? 'opacity-50' : ''}`}
        >
          {isLoading ? '파일 결합 중...' : '파일 결합'}
        </button>
      )}
    </div>
  );
} 