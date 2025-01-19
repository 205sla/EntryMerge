'use client';

import { FileUpload } from './components/FileUpload';

export default function Home() {
  return (
    <div className="container mx-auto px-4 py-8">
      <header className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">ENT File Merge Tool</h1>
        <p className="text-gray-600">
          여러 개의 .ent 파일을 하나로 병합하는 도구입니다
        </p>
      </header>
      
      <div className="max-w-2xl mx-auto">
        <FileUpload />
      </div>
    </div>
  );
}

