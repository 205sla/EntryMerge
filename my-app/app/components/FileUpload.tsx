'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';

interface FileUploadProps {
  onFileUpload: (files: File[]) => void;
}

export function FileUpload({ onFileUpload }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const entFiles = acceptedFiles.filter(file => file.name.endsWith('.ent'));
    if (entFiles.length > 0) {
      onFileUpload(entFiles);
      
      // 각 파일에 대해 압축 해제 요청
      for (const file of entFiles) {
        const formData = new FormData();
        formData.append('file', file);
        
        try {
          const response = await fetch('/api/extract', {
            method: 'POST',
            body: formData,
          });
          
          if (!response.ok) {
            throw new Error('압축 해제 실패');
          }
          
          const result = await response.json();
          console.log('압축 해제된 파일:', result);
        } catch (error) {
          console.error('파일 처리 중 오류:', error);
        }
      }
    }
  }, [onFileUpload]);

  const { getRootProps, getInputProps } = useDropzone({
    onDrop: (acceptedFiles) => {
      onDrop(acceptedFiles);
      setIsDragging(false);
    },
    accept: {
      'application/x-ent': ['.ent']
    },
    multiple: true,
    onDragEnter: () => setIsDragging(true),
    onDragLeave: () => setIsDragging(false),
    onDragOver: () => setIsDragging(true)
  });

  return (
    <div
      {...getRootProps()}
      className={`p-8 border-2 border-dashed rounded-lg text-center cursor-pointer border-gray-300 hover:border-blue-500 hover:bg-blue-50`}
    >
      <input {...getInputProps()} className="hidden" />
      <p className="text-gray-600">
        .ent 파일을 드래그 앤 드롭하거나 클릭하여 업로드하세요
      </p>
    </div>
  );
} 