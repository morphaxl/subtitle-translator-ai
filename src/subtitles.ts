export interface Subtitle {
  index: number;
  startTime: string;
  endTime: string;
  text: string;
}

export type SubtitleFormat = 'srt' | 'vtt' | 'ass';

export function detectFormat(content: string, filename?: string): SubtitleFormat {
  if (filename) {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext === 'vtt') return 'vtt';
    if (ext === 'ass' || ext === 'ssa') return 'ass';
    if (ext === 'srt') return 'srt';
  }
  
  if (content.trim().startsWith('WEBVTT')) return 'vtt';
  if (content.includes('[Script Info]') || content.includes('Format: Layer')) return 'ass';
  return 'srt';
}

function normalizeLineEndings(content: string): string {
  return content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function timeToMs(time: string): number {
  const match = time.match(/(\d{1,2}):(\d{2}):(\d{2})[,.](\d{3})/);
  if (!match) return 0;
  const [, h, m, s, ms] = match;
  return parseInt(h) * 3600000 + parseInt(m) * 60000 + parseInt(s) * 1000 + parseInt(ms);
}

function msToSrtTime(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const msRemainder = ms % 1000;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')},${msRemainder.toString().padStart(3, '0')}`;
}

function msToVttTime(ms: number): string {
  return msToSrtTime(ms).replace(',', '.');
}

export function parseSRT(content: string): Subtitle[] {
  const subtitles: Subtitle[] = [];
  const normalized = normalizeLineEndings(content);
  const blocks = normalized.split(/\n\n+/).filter(block => block.trim());
  
  for (const block of blocks) {
    const lines = block.split('\n').filter(line => line.trim());
    if (lines.length < 3) continue;
    
    const index = parseInt(lines[0], 10);
    if (isNaN(index)) continue;
    
    const timeMatch = lines[1].match(/(\d{2}:\d{2}:\d{2}[,\.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,\.]\d{3})/);
    if (!timeMatch) continue;
    
    subtitles.push({
      index,
      startTime: timeMatch[1].replace('.', ','),
      endTime: timeMatch[2].replace('.', ','),
      text: lines.slice(2).join('\n'),
    });
  }
  
  return subtitles;
}

export function parseVTT(content: string): Subtitle[] {
  const subtitles: Subtitle[] = [];
  const normalized = normalizeLineEndings(content);
  const blocks = normalized.split(/\n\n+/).filter(block => block.trim());
  
  let index = 0;
  for (const block of blocks) {
    if (block.trim() === 'WEBVTT' || block.startsWith('NOTE')) continue;
    
    const lines = block.split('\n').filter(line => line.trim());
    if (lines.length < 2) continue;
    
    let timeLineIdx = 0;
    if (!lines[0].includes('-->')) {
      timeLineIdx = 1;
      if (lines.length < 2) continue;
    }
    
    const timeMatch = lines[timeLineIdx].match(/(\d{2}:\d{2}:\d{2}\.\d{3}|\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3}|\d{2}:\d{2}\.\d{3})/);
    if (!timeMatch) continue;
    
    let startTime = timeMatch[1];
    let endTime = timeMatch[2];
    
    if (startTime.split(':').length === 2) startTime = '00:' + startTime;
    if (endTime.split(':').length === 2) endTime = '00:' + endTime;
    
    index++;
    subtitles.push({
      index,
      startTime: startTime.replace('.', ','),
      endTime: endTime.replace('.', ','),
      text: lines.slice(timeLineIdx + 1).join('\n').replace(/<[^>]+>/g, ''),
    });
  }
  
  return subtitles;
}

export function parseASS(content: string): Subtitle[] {
  const subtitles: Subtitle[] = [];
  const normalized = normalizeLineEndings(content);
  const lines = normalized.split('\n');
  
  let inEvents = false;
  let formatFields: string[] = [];
  let index = 0;
  
  for (const line of lines) {
    if (line.trim() === '[Events]') {
      inEvents = true;
      continue;
    }
    
    if (line.startsWith('[') && line.endsWith(']')) {
      inEvents = false;
      continue;
    }
    
    if (!inEvents) continue;
    
    if (line.startsWith('Format:')) {
      formatFields = line.substring(7).split(',').map(f => f.trim().toLowerCase());
      continue;
    }
    
    if (line.startsWith('Dialogue:')) {
      const values = line.substring(9).split(',');
      const startIdx = formatFields.indexOf('start');
      const endIdx = formatFields.indexOf('end');
      const textIdx = formatFields.indexOf('text');
      
      if (startIdx === -1 || endIdx === -1 || textIdx === -1) continue;
      
      const startTime = values[startIdx]?.trim();
      const endTime = values[endIdx]?.trim();
      const text = values.slice(textIdx).join(',').trim()
        .replace(/\\N/g, '\n')
        .replace(/\{[^}]+\}/g, '');
      
      if (!startTime || !endTime) continue;
      
      const formatTime = (t: string) => {
        const match = t.match(/(\d+):(\d{2}):(\d{2})\.(\d{2})/);
        if (!match) return '00:00:00,000';
        const [, h, m, s, cs] = match;
        return `${h.padStart(2, '0')}:${m}:${s},${cs}0`;
      };
      
      index++;
      subtitles.push({
        index,
        startTime: formatTime(startTime),
        endTime: formatTime(endTime),
        text,
      });
    }
  }
  
  return subtitles;
}

export function parse(content: string, format: SubtitleFormat): Subtitle[] {
  switch (format) {
    case 'vtt': return parseVTT(content);
    case 'ass': return parseASS(content);
    default: return parseSRT(content);
  }
}

export function toSRT(subtitles: Subtitle[]): string {
  return subtitles
    .map((sub, i) => `${i + 1}\n${sub.startTime} --> ${sub.endTime}\n${sub.text}`)
    .join('\n\n') + '\n';
}

export function toVTT(subtitles: Subtitle[]): string {
  const header = 'WEBVTT\n\n';
  const body = subtitles
    .map((sub, i) => {
      const start = sub.startTime.replace(',', '.');
      const end = sub.endTime.replace(',', '.');
      return `${i + 1}\n${start} --> ${end}\n${sub.text}`;
    })
    .join('\n\n');
  return header + body + '\n';
}

export function toASS(subtitles: Subtitle[]): string {
  const header = `[Script Info]
Title: Translated Subtitles
ScriptType: v4.00+
Collisions: Normal
PlayDepth: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,20,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,2,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
  
  const formatTime = (t: string) => {
    const match = t.match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})/);
    if (!match) return '0:00:00.00';
    const [, h, m, s, ms] = match;
    return `${parseInt(h)}:${m}:${s}.${ms.substring(0, 2)}`;
  };
  
  const dialogues = subtitles.map(sub => {
    const start = formatTime(sub.startTime);
    const end = formatTime(sub.endTime);
    const text = sub.text.replace(/\n/g, '\\N');
    return `Dialogue: 0,${start},${end},Default,,0,0,0,,${text}`;
  });
  
  return header + dialogues.join('\n') + '\n';
}

export function serialize(subtitles: Subtitle[], format: SubtitleFormat): string {
  switch (format) {
    case 'vtt': return toVTT(subtitles);
    case 'ass': return toASS(subtitles);
    default: return toSRT(subtitles);
  }
}

export function batchSubtitles(subtitles: Subtitle[], batchSize = 500, maxChars = 50000): Subtitle[][] {
  const batches: Subtitle[][] = [];
  let currentBatch: Subtitle[] = [];
  let currentChars = 0;
  
  for (const subtitle of subtitles) {
    const textLength = subtitle.text.length;
    
    if (currentBatch.length >= batchSize || (currentChars + textLength > maxChars && currentBatch.length > 0)) {
      batches.push(currentBatch);
      currentBatch = [];
      currentChars = 0;
    }
    
    currentBatch.push(subtitle);
    currentChars += textLength;
  }
  
  if (currentBatch.length > 0) batches.push(currentBatch);
  return batches;
}
