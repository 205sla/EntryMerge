'use client';

import React, { useState } from 'react';
import { FileUpload } from './components/FileUpload';

export default function Home() {
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);

  const handleFileUpload = (files: File[]) => {
    setUploadedFiles(prev => [...prev, ...files]);
  };

  return (
    <FileUpload onFileUpload={handleFileUpload} uploadedFiles={uploadedFiles} />
  );
} 