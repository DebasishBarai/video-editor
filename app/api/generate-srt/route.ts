import { NextResponse } from 'next/server';

// Define interfaces for the API response
interface Word {
  word: string;
  start: number;
  end: number;
}

interface Segment {
  start: number;
  end: number;
  text: string;
  temperature?: number;
  avg_logprob?: number;
  compression_ratio?: number;
  no_speech_prob?: number;
  words?: Word[];
}

interface TranscriptionInfo {
  language?: string;
  language_probability?: number;
  duration?: number;
  duration_after_vad?: number;
}

interface TranscriptionResult {
  transcription_info?: TranscriptionInfo;
  text: string;
  word_count?: number;
  segments?: Segment[];
  vtt?: string;
}

export async function POST(request: Request) {
  try {
    // Get the request body with the base64 encoded audio
    const { audio } = await request.json();

    if (!audio) {
      throw new Error('No audio data provided');
    }

    console.log('type of audio', typeof audio);

    console.log('Making request to Cloudflare API...');

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/openai/whisper`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`
        },
        body: JSON.stringify({ audio: audio })
      }
    );

    console.log('Response:', response);

    if (!response.ok) {
      // Try to get error response body
      let errorBody;
      try {
        errorBody = await response.text();
      } catch (e) {
        errorBody = 'Could not read error response body';
      }

      throw new Error(
        `HTTP error: ${JSON.stringify({
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          body: errorBody
        }, null, 2)}`
      );
    }

    const data = await response.json();

    console.log('Data:', data);
    
    if (!data.success) {
      throw new Error(`Cloudflare API error: ${data.errors?.[0]?.message || 'Unknown error'}`);
    }

    // Process the response according to the output schema
    const result = data.result as TranscriptionResult;

    // Convert segments to SRT format
    let srtContent = '';
    if (result.segments && Array.isArray(result.segments)) {
      srtContent = generateSRT(result.segments);
    }

    return NextResponse.json({
      success: true,
      result: {
        transcription_info: result.transcription_info,
        text: result.text,
        word_count: result.word_count,
        segments: result.segments,
        vtt: result.vtt,
        srt: srtContent
      }
    });
  } catch (err) {
    console.error('API Error:', err);
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
      details: err instanceof Error ? {
        name: err.name,
        message: err.message,
        stack: err.stack,
      } : undefined
    }, { status: 500 });
  }
}

// Helper function to generate SRT format from segments
function generateSRT(segments: Segment[]): string {
  return segments.map((segment, index) => {
    // Format start and end times as SRT timestamps (HH:MM:SS,mmm)
    const startTime = formatSRTTime(segment.start);
    const endTime = formatSRTTime(segment.end);

    return `${index + 1}\n${startTime} --> ${endTime}\n${segment.text}\n`;
  }).join('\n');
}

// Helper function to format time in SRT format
function formatSRTTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const milliseconds = Math.floor((seconds - Math.floor(seconds)) * 1000);

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(milliseconds).padStart(3, '0')}`;
}
