import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Upload to catbox.moe (reliable free file hosting, no registration needed)
    const uploadFormData = new FormData();
    uploadFormData.append('reqtype', 'fileupload');
    uploadFormData.append('fileToUpload', file);

    const response = await fetch('https://catbox.moe/user/api.php', {
      method: 'POST',
      body: uploadFormData,
    });

    if (!response.ok) {
      throw new Error('Upload failed');
    }

    const url = await response.text();
    
    if (!url || url.includes('error') || !url.startsWith('http')) {
      throw new Error('Invalid response from server');
    }

    return NextResponse.json({
      url: url.trim(),
      downloadUrl: url.trim(),
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
