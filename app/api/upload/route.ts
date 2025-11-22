import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Upload to file.io (free temporary file hosting)
    const uploadFormData = new FormData();
    uploadFormData.append('file', file);

    const response = await fetch('https://file.io', {
      method: 'POST',
      body: uploadFormData,
    });

    if (!response.ok) {
      throw new Error('Upload failed');
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || 'Upload failed');
    }

    return NextResponse.json({
      url: data.link,
      downloadUrl: data.link,
      name: file.name,
      size: file.size,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upload file' },
      { status: 500 }
    );
  }
}
