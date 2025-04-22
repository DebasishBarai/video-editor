import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { transcript, vtt } = await request.json();

    if (!transcript || !vtt) {
      throw new Error('No transcript or VTT data provided');
    }

    console.log('Making request to OpenAI GPT API...');

    const prompt = `You are a professional video editor and content strategist.

I will give you a **full transcript** of a video in VTT format (with timestamps). Based on this transcript, your task is to:

1. Analyze the content and identify natural topic breaks.
2. Generate a list of **YouTube-style chapters** that summarize the main sections of the video.
3. Format each chapter with a timestamp and a short, engaging title (max 6–8 words).
4. Ensure chapter titles are clear, concise, and help viewers understand what each section is about.

Only return the chapter list in this format:

00:00 - [Title of Section 1]  
02:15 - [Title of Section 2]  
05:42 - [Title of Section 3]  
...

Make sure:
- Chapters are spaced roughly every 2–5 minutes (unless a topic shift demands otherwise)
- Titles reflect **what the speaker is saying**, not just generic phrases like "Discussion"
- If no content is worth splitting, return just 2–3 chapters max
- Use the timestamps from the VTT to ensure accurate chapter timing

Here is the transcript in VTT format:
${vtt}`;

    const response = await fetch(
      'https://api.openai.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-4-1106-preview',
          messages: [
            {
              role: 'system',
              content: 'You are a professional video editor and content strategist. Your task is to generate YouTube-style chapters from video transcripts with timestamps.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 500
        })
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

    const data = await response.json();
    const chapters = data.choices[0].message.content;

    return NextResponse.json({
      success: true,
      result: {
        chapters
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