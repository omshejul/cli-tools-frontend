import { API_ENDPOINTS } from './config';

export interface Format {
  format_id: string;
  ext: string;
  resolution: string;
  filesize: number | 'N/A';
  vcodec: string;
  acodec: string;
  format_note: string;
  description: string;
}

export interface FormatResponse {
  title: string;
  formats: Format[];
}

export interface VideoRequest {
  url: string;
  format: string;
  output_dir?: string;
  websocket_id?: string;
}

export async function checkApiStatus(): Promise<boolean> {
  try {
    const response = await fetch(API_ENDPOINTS.status);
    return response.ok;
  } catch (error) {
    console.error('API Status Check Error:', error);
    return false;
  }
}

export async function getFormats(url: string): Promise<FormatResponse> {
  try {
    const response = await fetch(API_ENDPOINTS.formats, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Get Formats Error:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to fetch formats');
  }
}

export async function downloadVideo({ url, format, output_dir, websocket_id }: VideoRequest): Promise<Response> {
  console.log('🔄 [API] Making download request with websocket_id:', websocket_id);
  const response = await fetch(`${API_ENDPOINTS.download}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url, format, output_dir, websocket_id }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to download video');
  }

  return response;
} 