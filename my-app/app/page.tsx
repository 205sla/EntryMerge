'use client';

import { useState } from 'react';
import { FileUpload } from './components/FileUpload';

export default function Home() {
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);

  const handleFileUpload = (files: File[]) => {
    setUploadedFiles(prev => [...prev, ...files]);
  };

  return (
    <main className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">ENT 파일 결합 도구</h1>
      
      <FileUpload onFileUpload={handleFileUpload} />
      
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
    </main>
  );
}
