// API Configuration
// In development, use localhost:4000
// In production, use relative URLs or set VITE_API_URL environment variable

const getApiUrl = (): string => {
  // Check if we're in development (Vite sets this automatically)
  if (import.meta.env.DEV) {
    // Development: use localhost or VITE_API_URL if set
    return import.meta.env.VITE_API_URL || 'http://localhost:4000';
  }
  
  // Production: use VITE_API_URL if set, otherwise use relative URLs
  return import.meta.env.VITE_API_URL || '';
};

export const API_URL = getApiUrl();

// Helper function to build API endpoint URLs
export const apiUrl = (endpoint: string): string => {
  // Remove leading slash if present
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  
  // If API_URL is empty (production without VITE_API_URL), use relative URL
  if (!API_URL) {
    return `/${cleanEndpoint}`;
  }
  
  // Otherwise, use absolute URL
  return `${API_URL}/${cleanEndpoint}`;
};

