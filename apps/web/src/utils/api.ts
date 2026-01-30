/**
 * API utility with retry logic, error handling, and timeout support
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface ApiError {
  message: string;
  status?: number;
  isNetworkError: boolean;
  isTimeout: boolean;
  retryable: boolean;
}

export interface FetchOptions extends RequestInit {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  onRetry?: (attempt: number, error: ApiError) => void;
}

const DEFAULT_TIMEOUT = 30000; // 30 seconds
const DEFAULT_RETRIES = 3;
const DEFAULT_RETRY_DELAY = 1000; // 1 second base delay

/**
 * Determines if an error is retryable
 */
function isRetryableError(status: number | undefined, isNetworkError: boolean): boolean {
  if (isNetworkError) return true;
  if (!status) return true;
  // Retry on server errors and rate limiting
  return status >= 500 || status === 429 || status === 408;
}

/**
 * Calculate exponential backoff delay with jitter
 */
function calculateBackoff(attempt: number, baseDelay: number): number {
  const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
  const jitter = Math.random() * 0.3 * exponentialDelay; // 0-30% jitter
  return Math.min(exponentialDelay + jitter, 30000); // Cap at 30 seconds
}

/**
 * Fetch with timeout support
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeout: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Parse error response from API
 */
async function parseErrorResponse(response: Response): Promise<string> {
  try {
    const data = await response.json();
    return data.error || data.message || `Request failed with status ${response.status}`;
  } catch {
    return `Request failed with status ${response.status}`;
  }
}

/**
 * Enhanced fetch with retry logic, timeout, and error handling
 */
export async function apiFetch<T>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const {
    timeout = DEFAULT_TIMEOUT,
    retries = DEFAULT_RETRIES,
    retryDelay = DEFAULT_RETRY_DELAY,
    onRetry,
    ...fetchOptions
  } = options;

  const url = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint}`;
  let lastError: ApiError | null = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // Don't set Content-Type for FormData - browser will set it with boundary
      const isFormData = fetchOptions.body instanceof FormData;
      const headers: HeadersInit = isFormData
        ? { ...fetchOptions.headers }
        : { 'Content-Type': 'application/json', ...fetchOptions.headers };

      const response = await fetchWithTimeout(url, {
        ...fetchOptions,
        headers
      }, timeout);

      if (!response.ok) {
        const message = await parseErrorResponse(response);
        const error: ApiError = {
          message,
          status: response.status,
          isNetworkError: false,
          isTimeout: false,
          retryable: isRetryableError(response.status, false)
        };

        if (error.retryable && attempt < retries) {
          lastError = error;
          onRetry?.(attempt, error);
          await sleep(calculateBackoff(attempt, retryDelay));
          continue;
        }

        throw error;
      }

      // Handle empty responses
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        return {} as T;
      }

      return await response.json();
    } catch (err) {
      // Handle abort/timeout
      if (err instanceof DOMException && err.name === 'AbortError') {
        const error: ApiError = {
          message: 'Request timed out',
          isNetworkError: false,
          isTimeout: true,
          retryable: true
        };

        if (attempt < retries) {
          lastError = error;
          onRetry?.(attempt, error);
          await sleep(calculateBackoff(attempt, retryDelay));
          continue;
        }

        throw error;
      }

      // Handle network errors
      if (err instanceof TypeError && err.message.includes('fetch')) {
        const error: ApiError = {
          message: 'Network error. Please check your connection.',
          isNetworkError: true,
          isTimeout: false,
          retryable: true
        };

        if (attempt < retries) {
          lastError = error;
          onRetry?.(attempt, error);
          await sleep(calculateBackoff(attempt, retryDelay));
          continue;
        }

        throw error;
      }

      // Re-throw API errors
      if ((err as ApiError).message) {
        throw err;
      }

      // Unknown error
      throw {
        message: 'An unexpected error occurred',
        isNetworkError: false,
        isTimeout: false,
        retryable: false
      } as ApiError;
    }
  }

  // Should not reach here, but just in case
  throw lastError || {
    message: 'Request failed after retries',
    isNetworkError: false,
    isTimeout: false,
    retryable: false
  };
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * API methods with built-in error handling
 */
export const api = {
  get: <T>(endpoint: string, options?: FetchOptions) =>
    apiFetch<T>(endpoint, { ...options, method: 'GET' }),

  post: <T>(endpoint: string, body: unknown, options?: FetchOptions) =>
    apiFetch<T>(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(body)
    }),

  /**
   * POST with FormData (for file uploads)
   * Note: Don't set Content-Type header - browser will set it with boundary
   */
  postFormData: <T>(endpoint: string, formData: FormData, options?: FetchOptions) =>
    apiFetch<T>(endpoint, {
      ...options,
      method: 'POST',
      body: formData,
      headers: {
        // Remove Content-Type to let browser set it with boundary for multipart
        ...options?.headers
      }
    }),

  patch: <T>(endpoint: string, body: unknown, options?: FetchOptions) =>
    apiFetch<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: JSON.stringify(body)
    }),

  delete: <T>(endpoint: string, body?: unknown, options?: FetchOptions) =>
    apiFetch<T>(endpoint, {
      ...options,
      method: 'DELETE',
      body: body ? JSON.stringify(body) : undefined
    })
};

/**
 * Type guard to check if error is an ApiError
 */
export function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    'retryable' in error
  );
}

/**
 * Get user-friendly error message
 */
export function getErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unexpected error occurred';
}
