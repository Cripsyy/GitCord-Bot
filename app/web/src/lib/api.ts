import { showError, showSuccess, showWarning } from "./toast";

export interface ApiOptions {
  showError?: boolean;
  showSuccess?: boolean;
  successMessage?: string;
  errorPrefix?: string;
  onError?: (error: ApiError) => void;
}

export class ApiError extends Error {
  code?: string;
  warning?: string;

  constructor(message: string, code?: string, warning?: string) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.warning = warning;
  }
}

async function extractError(response: Response): Promise<ApiError> {
  let message: string;
  let code: string | undefined;
  let warning: string | undefined;

  try {
    const body = await response.json();
    if (typeof body.detail === "string") message = body.detail;
    else if (typeof body.error === "string") message = body.error;
    else if (typeof body.message === "string") message = body.message;
    else message = JSON.stringify(body);
    code = body.code;
    warning = body.warning;
  } catch {
    const text = await response.text();
    message = text || response.statusText;
  }

  return new ApiError(message, code, warning);
}

async function request<T>(
  path: string,
  init: RequestInit,
  options?: ApiOptions,
): Promise<T> {
  const response = await fetch(path, init);

  if (!response.ok) {
    const apiError = await extractError(response);

    if (options?.errorPrefix) {
      apiError.message = `${options.errorPrefix} ${apiError.message}`;
    }

    if (options?.showError !== false) {
      showError(apiError.message);
    }
    if (apiError.warning) {
      showWarning(apiError.warning);
    }

    options?.onError?.(apiError);
    throw apiError;
  }

  let data: T;
  if (response.status === 204) {
    data = undefined as T;
  } else {
    data = (await response.json()) as T;
  }

  if (options?.showSuccess && options?.successMessage) {
    showSuccess(options.successMessage);
  }

  return data;
}

export async function get<T>(path: string, options?: ApiOptions): Promise<T> {
  return request<T>(path, { method: "GET" }, options);
}

export async function post<T = void>(
  path: string,
  body?: Record<string, unknown>,
  options?: ApiOptions,
): Promise<T> {
  const init: RequestInit = { method: "POST" };
  if (body !== undefined) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(body);
  }
  return request<T>(path, init, options);
}

export async function put<T = void>(
  path: string,
  body?: Record<string, unknown>,
  options?: ApiOptions,
): Promise<T> {
  const init: RequestInit = { method: "PUT" };
  if (body !== undefined) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(body);
  }
  return request<T>(path, init, options);
}

export async function del<T = void>(
  path: string,
  options?: ApiOptions,
): Promise<T> {
  return request<T>(path, { method: "DELETE" }, options);
}

export const api = { get, post, put, delete: del };
