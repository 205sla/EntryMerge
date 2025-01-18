import { NextRequest, NextResponse } from 'next/server';
import * as tar from 'tar-stream';
import { Readable } from 'stream';
import { randomBytes } from 'crypto';

const generateRandomString = (length: number) => {
  return randomBytes(length).toString('hex').slice(0, length);
};

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    
    const extractedFiles: { [key: string]: any } = {};
    const pack = tar.pack();
    
    // 각 파일 압축 해제 및 결합
    for (const file of files) {
      const extract = tar.extract();
      const buffer = Buffer.from(await file.arrayBuffer());
      
      await new Promise<void>((resolve, reject) => {
        extract.on('entry', async (header, stream, next) => {
          const chunks: Buffer[] = [];
          stream.on('data', chunk => chunks.push(chunk));
          stream.on('end', () => {
            const content = Buffer.concat(chunks);
            
            if (header.name === 'project.json') {
              const projectData = JSON.parse(content.toString());
              
              // scene 값 중복 처리
              projectData.scene = generateRandomString(4);
              if (projectData.scenes) {
                projectData.scenes.forEach((scene: any) => {
                  scene.id = generateRandomString(4);
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
        readable.push(buffer);
        readable.push(null);
        readable.pipe(extract);
      });
    }
    
    // 결합된 파일들을 새로운 tar 파일로 압축
    for (const [name, content] of Object.entries(extractedFiles)) {
      pack.entry({ name }, content);
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
    
  } catch (error) {
    console.error('파일 결합 중 오류:', error);
    return NextResponse.json(
      { error: '파일 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 