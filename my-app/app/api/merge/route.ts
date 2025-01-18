import { NextRequest, NextResponse } from 'next/server';
import * as tar from 'tar-stream';
import { Readable } from 'stream';
import { randomBytes } from 'crypto';
import { gunzip } from 'zlib';
import { promisify } from 'util';

const gunzipAsync = promisify(gunzip);

/** 중복 방지를 위한 랜덤 문자열 생성 함수 */
function generateRandomString(length: number): string {
  return randomBytes(length).toString('hex').slice(0, length);
}

interface SceneData {
  id: string;
  name: string;
  [key: string]: any;
}
interface ObjectData {
  id: string;
  name: string;
  scene?: string; // 장면 참조
  [key: string]: any;
}
interface ProjectData {
  scene?: string;
  scenes?: SceneData[];
  objects?: ObjectData[];
  // assets는 엔트리 파일 구조상 명시적으로 쓰지 않아도 됨
  variables?: any[];
  messages?: any[];
  functions?: any[];
  tables?: any[];
  [key: string]: any; // 기타 프로퍼티
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    // 업로드된 엔트리 파일 개수 검증
    if (!files || files.length < 2) {
      return NextResponse.json(
        { error: '최소 2개 이상의 ENT 파일이 필요합니다.' },
        { status: 400 }
      );
    }

    // 최종적으로 tar로 묶기 전, 임시로 파일을 담아둘 객체
    // Key: tar entry path (e.g. "temp/project.json", "temp/0a/image.png")
    // Value: file content (Buffer)
    const extractedFiles: Record<string, Buffer> = {};

    // 각 ent 파일의 project.json을 모두 모은 배열
    const projectJsons: ProjectData[] = [];

    // 사용 중인 경로(폴더/파일) 모음 (중복 체크용)
    const usedPaths = new Set<string>();

    /**
     * 특정 파일 경로가 이미 존재할 경우,
     * 파일/폴더 이름에 랜덤 접미사를 붙여 충돌을 피하는 함수
     * 예: "temp/0a/image.png" → "temp/0a/image_1a2b.png"
     *     "temp/0a" → "temp/0a_1a2b"
     */
    function resolvePathConflict(originalPath: string): string {
      let newPath = originalPath;
      const dirIndex = newPath.lastIndexOf('/');

      // (1) 폴더 경로 vs 파일 경로
      //   파일이면 확장자 있을 수 있음
      //   폴더면 그냥 전체가 이름일 수 있음
      // 여기서는 단순하게 "마지막 슬래시 뒤가 폴더 or 파일 이름"으로 간주

      if (usedPaths.has(newPath)) {
        // 중복된 경로가 존재하면, 랜덤 접미사 반복 부여
        const suffix = generateRandomString(4);

        if (dirIndex >= 0) {
          const pathDir = newPath.slice(0, dirIndex + 1); // e.g. "temp/0a/"
          let basename = newPath.slice(dirIndex + 1);     // e.g. "image.png" or "0a" or "image"

          // 파일 확장자 분리
          const dotIndex = basename.lastIndexOf('.');
          if (dotIndex > 0) {
            // 확장자가 있는 경우
            const base = basename.substring(0, dotIndex);
            const ext = basename.substring(dotIndex);
            basename = `${base}_${suffix}${ext}`; // e.g. "image_1a2b.png"
          } else {
            // 확장자 없는 경우(폴더 or 확장자 없는 파일)
            basename = `${basename}_${suffix}`;   // e.g. "0a_1a2b"
          }

          newPath = pathDir + basename;
        } else {
          // (잘 없겠지만) "temp" 같은 최상위 경로에 충돌이 있을 때
          newPath = `${newPath}_${suffix}`;
        }

        // 충돌이 여전히 존재하면 재귀적으로 다시 해결
        if (usedPaths.has(newPath)) {
          return resolvePathConflict(newPath);
        }
      }

      // 결정된 경로를 반환
      return newPath;
    }

    // ─────────────────────────────────────────────────────────
    // 1) 업로드된 각 ENT 파일을 해제(gunzip + tar.extract)
    // ─────────────────────────────────────────────────────────
    for (const file of files) {
      const fileBuffer = Buffer.from(await file.arrayBuffer());
      const unzippedBuffer = await gunzipAsync(fileBuffer);

      const extract = tar.extract();
      await new Promise<void>((resolve, reject) => {
        extract.on('entry', (header, stream, next) => {
          const chunks: Buffer[] = [];
          stream.on('data', (chunk) => chunks.push(chunk));
          stream.on('end', () => {
            const content = Buffer.concat(chunks);

            // 엔트리 경로 예시: "temp/project.json", "temp/0a/image.png", "temp/fd/bgm.mp3"
            const originalPath = header.name;

            if (originalPath === 'temp/project.json') {
              // project.json은 파싱해서 projectJsons에 보관
              const projectData = JSON.parse(content.toString()) as ProjectData;
              projectJsons.push(projectData);
            } else {
              // 그 외 파일/폴더는 그대로 extractedFiles에 저장
              // 단, 중복된 경로가 있으면 resolvePathConflict()로 해결
              if (!originalPath.startsWith('temp/')) {
                // 혹시 temp/로 시작 안하는 특수 케이스가 있다면, 그대로 사용
                const safePath = resolvePathConflict(originalPath);
                extractedFiles[safePath] = content;
                usedPaths.add(safePath);
              } else {
                // "temp/..." 구조인 경우
                const safePath = resolvePathConflict(originalPath);
                extractedFiles[safePath] = content;
                usedPaths.add(safePath);
              }
            }
            next();
          });
          stream.resume();
        });

        extract.on('finish', resolve);
        extract.on('error', reject);

        const readable = new Readable();
        readable._read = () => {};
        readable.push(unzippedBuffer);
        readable.push(null);
        readable.pipe(extract);
      });
    }

    // ─────────────────────────────────────────────────────────
    // 2) project.json 병합
    // ─────────────────────────────────────────────────────────
    // 최종 하나의 프로젝트 구조를 담을 mergedProject
    const mergedProject: ProjectData = {
      scene: generateRandomString(4),
      scenes: [],
      objects: [],
      variables: [],
      messages: [],
      functions: [],
      tables: [],
    };

    // 이미 사용된 scene ID를 추적
    const usedSceneIds = new Set<string>();

    for (const project of projectJsons) {
      // scenes
      const sceneIdMap = new Map<string, string>();

      if (Array.isArray(project.scenes)) {
        for (const scene of project.scenes) {
          let newId = scene.id;
          // 중복이면 새 랜덤 ID
          if (usedSceneIds.has(newId)) {
            newId = generateRandomString(4);
            while (usedSceneIds.has(newId)) {
              newId = generateRandomString(4);
            }
          }
          usedSceneIds.add(newId);

          const oldId = scene.id;
          scene.id = newId;
          sceneIdMap.set(oldId, newId);

          (mergedProject.scenes as SceneData[]).push(scene);
        }
      }

      // objects[].scene 업데이트
      if (Array.isArray(project.objects)) {
        for (const obj of project.objects) {
          if (obj.scene && sceneIdMap.has(obj.scene)) {
            obj.scene = sceneIdMap.get(obj.scene);
          }
        }
        (mergedProject.objects as ObjectData[]).push(...project.objects);
      }

      // variables, messages, functions, tables 등은 배열로 이어붙이기
      const arrayProps = ['variables', 'messages', 'functions', 'tables'];
      for (const key of arrayProps) {
        if (Array.isArray(project[key])) {
          mergedProject[key] = [
            ...(mergedProject[key] || []),
            ...project[key],
          ];
        }
      }

      // 기타 나머지 프로퍼티(예: name, expansionBlocks, etc.) 처리
      for (const [k, v] of Object.entries(project)) {
        if ([
          'scene','scenes','objects',
          'variables','messages','functions','tables'
        ].includes(k)) {
          continue; // 이미 처리
        }
        // 병합 규칙(필요 시 수정)
        if (Array.isArray(v)) {
          if (!mergedProject[k]) mergedProject[k] = [];
          mergedProject[k] = [...mergedProject[k], ...v];
        } else if (typeof v === 'object' && v !== null) {
          if (!mergedProject[k] || typeof mergedProject[k] !== 'object') {
            mergedProject[k] = {};
          }
          mergedProject[k] = {
            ...mergedProject[k],
            ...v,
          };
        } else {
          mergedProject[k] = v; // 문자열, 숫자 등은 덮어쓰기
        }
      }
    }

    // ─────────────────────────────────────────────────────────
    // 3) 최종 mergedProject를 "temp/project.json"으로 저장
    // ─────────────────────────────────────────────────────────
    // 만약 "temp/project.json"이 이미 존재한다면, 위의 충돌 처리 로직에 의해
    // 이름이 다른 것으로 바뀌었을 것이므로 여기엔 문제 없이 저장됨
    const finalProjectJsonPath = 'temp/project.json';
    extractedFiles[finalProjectJsonPath] = Buffer.from(
      JSON.stringify(mergedProject, null, 2)
    );
    usedPaths.add(finalProjectJsonPath);

    // ─────────────────────────────────────────────────────────
    // 4) tar.pack()으로 모든 파일 묶고 응답 반환
    // ─────────────────────────────────────────────────────────
    const tarStream = tar.pack();
    for (const [name, buf] of Object.entries(extractedFiles)) {
      tarStream.entry({ name }, buf);
    }
    tarStream.finalize();

    const chunks: Buffer[] = [];
    tarStream.on('data', (chunk) => chunks.push(chunk));
    const finalBuffer = await new Promise<Buffer>((resolve, reject) => {
      tarStream.on('end', () => resolve(Buffer.concat(chunks)));
      tarStream.on('error', reject);
    });

    return new NextResponse(finalBuffer, {
      headers: {
        'Content-Type': 'application/x-tar',
        'Content-Disposition': 'attachment; filename="merged.ent"',
      },
    });

  } catch (error: any) {
    console.error('[ERROR merging ENT files]', error);
    return NextResponse.json(
      { error: error?.message ?? '알 수 없는 오류' },
      { status: 500 }
    );
  }
}
