import { NextRequest, NextResponse } from 'next/server';
import * as tar from 'tar-stream';
import { Readable } from 'stream';
import { randomBytes } from 'crypto';
import { gunzip } from 'zlib';
import { promisify } from 'util';

const gunzipAsync = promisify(gunzip);

// 임의의 문자열 생성 함수
const generateRandomString = (length: number) => {
  return randomBytes(length).toString('hex').slice(0, length);
};

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    
    if (!files || files.length < 2) {
      return NextResponse.json(
        { error: '최소 2개 이상의 파일이 필요합니다.' },
        { status: 400 }
      );
    }

    console.log('처리할 파일:', files.map(f => f.name));  // 디버깅용
    
    const extractedFiles: { [key: string]: any } = {};
    const pack = tar.pack();
    
    const usedIds = new Set<string>();  // 사용된 id 값을 추적

    // 각 파일 압축 해제 및 결합
    for (const file of files) {
      const extract = tar.extract();
      const buffer = Buffer.from(await file.arrayBuffer());
      
      // gzip 압축 해제 추가
      const unzippedBuffer = await gunzipAsync(buffer);
      
      await new Promise<void>((resolve, reject) => {
        extract.on('entry', async (header, stream, next) => {
          const chunks: Buffer[] = [];
          stream.on('data', chunk => chunks.push(chunk));
          stream.on('end', () => {
            const content = Buffer.concat(chunks);
            
            if (header.name === 'project.json') {
              const projectData = JSON.parse(content.toString());
              
              // scene 값 중복 처리
              let newSceneId = generateRandomString(4);
              while (usedIds.has(newSceneId)) {  // 중복 체크
                newSceneId = generateRandomString(4);
              }
              usedIds.add(newSceneId);
              projectData.scene = newSceneId;

              // scenes 배열의 id 값 중복 처리
              if (projectData.scenes) {
                projectData.scenes.forEach((scene: any) => {
                  let newId = generateRandomString(4);
                  while (usedIds.has(newId)) {  // 중복 체크
                    newId = generateRandomString(4);
                  }
                  usedIds.add(newId);
                  scene.id = newId;
                });
              }
              
              // assets 폴더 이름 중복 처리
              if (projectData.assets) {
                const newAssetsName = generateRandomString(2);
                projectData.assets = projectData.assets.replace(/assets/g, newAssetsName);
                extractedFiles[`${newAssetsName}/`] = extractedFiles['assets/'];
                delete extractedFiles['assets/'];
              }
              
              extractedFiles[header.name] = Buffer.from(JSON.stringify(projectData));
            } else {
              extractedFiles[header.name] = content;
            }
            next();
          });
          stream.resume();
        });
        
        extract.on('finish', resolve);
        extract.on('error', reject);
        
        const readable = new Readable();
        readable._read = () => {};
        readable.push(unzippedBuffer);  // 압축 해제된 버퍼 사용
        readable.push(null);
        readable.pipe(extract);
      });
    }
    
    // 결합된 파일들을 새로운 tar 파일로 압축
    for (const [name, content] of Object.entries(extractedFiles)) {
      pack.entry({ name }, content);  // level 옵션 제거
    }
    pack.finalize();
    
    // 압축된 파일을 클라이언트에 전송
    const chunks: Buffer[] = [];
    pack.on('data', chunk => chunks.push(chunk));
    
    const finalBuffer = await new Promise<Buffer>((resolve, reject) => {
      pack.on('end', () => resolve(Buffer.concat(chunks)));
      pack.on('error', reject);
    });
    
    return new NextResponse(finalBuffer, {
      headers: {
        'Content-Type': 'application/x-tar',
        'Content-Disposition': 'attachment; filename="merged.ent"'
      }
    });
    
  } catch (error: unknown) {
    console.error('상세 에러:', error);
    const message = error instanceof Error ? error.message : '알 수 없는 오류';
    return NextResponse.json(
      { error: `파일 처리 중 오류: ${message}` },
      { status: 500 }
    );
  }
} 