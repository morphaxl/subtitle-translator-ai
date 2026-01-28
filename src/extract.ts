import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface SubtitleStream {
  index: number;
  streamIndex: string;
  codec: string;
  language: string;
  title: string;
  default: boolean;
  forced: boolean;
}

export interface ExtractResult {
  outputPath: string;
  stream: SubtitleStream;
}

export async function listSubtitleStreams(inputPath: string): Promise<SubtitleStream[]> {
  const { stdout } = await execAsync(
    `ffprobe -v error -select_streams s -show_entries stream=index,codec_name:stream_tags=language,title -of json "${inputPath}"`
  );

  const data = JSON.parse(stdout);
  const streams: SubtitleStream[] = [];

  if (!data.streams) return streams;

  for (let i = 0; i < data.streams.length; i++) {
    const stream = data.streams[i];
    streams.push({
      index: i,
      streamIndex: `0:s:${i}`,
      codec: stream.codec_name || 'unknown',
      language: stream.tags?.language || 'und',
      title: stream.tags?.title || '',
      default: false,
      forced: false,
    });
  }

  return streams;
}

function getOutputExtension(codec: string): string {
  const codecMap: Record<string, string> = {
    subrip: 'srt',
    srt: 'srt',
    ass: 'ass',
    ssa: 'ass',
    webvtt: 'vtt',
    mov_text: 'srt',
    dvd_subtitle: 'sub',
    hdmv_pgs_subtitle: 'sup',
    pgssub: 'sup',
  };
  return codecMap[codec.toLowerCase()] || 'srt';
}

export async function extractSubtitle(
  inputPath: string,
  streamIndex: number,
  outputPath?: string,
  codec?: string
): Promise<string> {
  const streams = await listSubtitleStreams(inputPath);
  
  if (streamIndex >= streams.length) {
    throw new Error(`Stream index ${streamIndex} not found. File has ${streams.length} subtitle stream(s).`);
  }

  const stream = streams[streamIndex];
  const ext = getOutputExtension(codec || stream.codec);
  const baseName = inputPath.replace(/\.[^.]+$/, '');
  const langSuffix = stream.language !== 'und' ? `.${stream.language}` : '';
  const finalOutput = outputPath || `${baseName}${langSuffix}.${ext}`;

  await execAsync(
    `ffmpeg -y -i "${inputPath}" -map 0:s:${streamIndex} -c:s ${ext === 'srt' ? 'srt' : 'copy'} "${finalOutput}"`
  );

  return finalOutput;
}

export async function extractAllSubtitles(inputPath: string, outputDir?: string): Promise<ExtractResult[]> {
  const streams = await listSubtitleStreams(inputPath);
  const results: ExtractResult[] = [];
  const baseName = inputPath.replace(/\.[^.]+$/, '');

  for (let i = 0; i < streams.length; i++) {
    const stream = streams[i];
    const ext = getOutputExtension(stream.codec);
    const langSuffix = stream.language !== 'und' ? `.${stream.language}` : `.track${i}`;
    const outputPath = outputDir 
      ? `${outputDir}/${baseName.split('/').pop()}${langSuffix}.${ext}`
      : `${baseName}${langSuffix}.${ext}`;

    await execAsync(
      `ffmpeg -y -i "${inputPath}" -map 0:s:${i} -c:s ${ext === 'srt' ? 'srt' : 'copy'} "${outputPath}"`
    );

    results.push({ outputPath, stream });
  }

  return results;
}
