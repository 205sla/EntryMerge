import { NextResponse } from 'next/server';
import * as tar from 'tar-stream';
import { Readable } from 'stream';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { error: '파일이 없습니다.' },
        { status: 400 }
      );
    }

    const extract = tar.extract();
    const files: { [key: string]: Buffer } = {};

    extract.on('entry', async (header, stream, next) => {
      const chunks: Buffer[] = [];
      
      stream.on('data', (chunk) => chunks.push(chunk));
      
      stream.on('end', () => {
        files[header.name] = Buffer.concat(chunks);
        next();
      });
      
      stream.resume();
    });

    // 파일을 Buffer로 변환
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // tar 스트림 생성 및 처리
    const readable = Readable.from(buffer);
    readable.pipe(extract);

    return NextResponse.json({ 
      files,
      message: '압축 해제 완료' 
    });

  } catch (error) {
    console.error('압축 해제 중 오류 발생:', error);
    return NextResponse.json(
      { error: '파일 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 