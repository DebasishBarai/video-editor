import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      throw new Error('No audio file provided');
    }

    console.log('Making request to OpenAI Whisper API...');

    // Create new FormData with required parameters
    const apiFormData = new FormData();
    apiFormData.append('file', file);
    apiFormData.append('model', 'whisper-1');
    apiFormData.append('response_format', 'vtt');
    apiFormData.append('language', 'en');

    const response = await fetch(
      'https://api.openai.com/v1/audio/transcriptions',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: apiFormData
      }
    );

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

    const vttData = await response.text();

    // Convert VTT to text for the full transcription
    const text = vttData
      .split('\n')
      .filter(line => !line.includes('-->') && !line.startsWith('WEBVTT') && line.trim() !== '')
      .join(' ');

    return NextResponse.json({
      success: true,
      result: {
        text,
        vtt: vttData
      }
    });
  } catch (err) {
    console.error('API Error:', err);
    return NextResponse.json({
      success: false,
      error: JSON.stringify({ error: err }),
    }, { status: 500 });
  }
}
