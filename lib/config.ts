export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://cli.theom.app';

// Log the configuration on load
console.log('[Config] API_BASE_URL:', API_BASE_URL);

export const API_ENDPOINTS = {
  formats: `${API_BASE_URL}/formats`,
  download: `${API_BASE_URL}/download`,
  status: `${API_BASE_URL}/status`,
  info: `${API_BASE_URL}/info`
} as const; 