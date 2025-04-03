import { API_ENDPOINTS } from './config';

export interface Format {
  format_id: string;
  ext: string;
  resolution: string;
  filesize: number;
  filesize_mb: string;
  vcodec: string;
  acodec: string;
  total_bitrate: string;
  video_bitrate: string;
  audio_bitrate: string;
  fps: number;
  dynamic_range: string;
  format_note: string;
  description: string;
}

export interface FormatResponse {
  title: string;
  formats: Format[];
  note: string;
}

export interface VideoRequest {
  url: string;
  format: string;
  output_dir?: string;
  optimize_for_quicktime?: boolean;
}

export interface VideoMetadata {
  filename: string;
  filetype: string;
  mime_type: string;
  title: string;
  filesize: number;
  filesize_formatted: string;
}

export interface DownloadProgress {
  percentage: number;
  loaded: number;
  total: number;
}

export interface VideoInfo {
  filename: string;
  filesize: number;
  filesize_formatted: string;
  mime_type: string;
}

export interface DownloadRequest {
  url: string;
  format: string;
  optimize_for_quicktime?: boolean;
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
      const error = await response.json();
      throw new Error(error.detail || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Get Formats Error:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to fetch formats');
  }
}

export async function getVideoInfo(request: VideoRequest): Promise<VideoInfo> {
  const response = await fetch(`${API_ENDPOINTS.info}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to get video info');
  }

  return await response.json();
}

export async function downloadVideo(
  values: DownloadRequest,
  info: VideoInfo,
  onProgress?: (progress: DownloadProgress) => void
): Promise<Blob> {
  const response = await fetch(`${API_ENDPOINTS.download}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(values),
  });

  if (!response.ok) {
    throw new Error("Failed to download video");
  }

  const reader = response.body?.getReader();
  const contentLength = parseInt(response.headers.get("Content-Length") || "0");

  if (!reader) {
    throw new Error("Failed to read response");
  }

  let receivedLength = 0;
  const chunks: Uint8Array[] = [];

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    chunks.push(value);
    receivedLength += value.length;

    if (onProgress) {
      onProgress({
        loaded: receivedLength,
        total: contentLength,
        percentage: (receivedLength / contentLength) * 100,
      });
    }
  }

  const blob = new Blob(chunks, { type: info.mime_type });
  return blob;
} 