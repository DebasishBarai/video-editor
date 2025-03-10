import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    // Get the request body with the base64 encoded audio
    const { audio } = await request.json();

    if (!audio) {
      throw new Error('No audio data provided');
    }

    console.log('Making request to Cloudflare API...');

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/openai/whisper-large-v3-turbo`,
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

    console.log({ result: data.result });

    return NextResponse.json({
      success: true,
      result: data.result
    });
  } catch (err) {
    console.error('API Error:', err);
    return NextResponse.json({
      success: false,
      error: JSON.stringify({ error: err }),
    }, { status: 500 });
  }
}
