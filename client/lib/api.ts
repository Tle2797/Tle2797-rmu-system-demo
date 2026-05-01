const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3080";

async function readResponsePayload(res: Response): Promise<unknown> {
  const text = await res.text().catch(() => "");
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function extractErrorMessage(data: unknown, status: number): string {
  if (typeof data === "string" && data.trim()) {
    return data;
  }

  if (data && typeof data === "object") {
    const message =
      (data as { message?: unknown; error?: unknown }).message ??
      (data as { message?: unknown; error?: unknown }).error;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }

  return `Request failed (${status})`;
}

async function readErrorMessage(res: Response): Promise<string> {
  return extractErrorMessage(await readResponsePayload(res), res.status);
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

function buildHeaders(withJsonBody: boolean): HeadersInit {
  const headers: Record<string, string> = {};
  if (withJsonBody) headers["Content-Type"] = "application/json";

  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  return headers;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "GET",
    cache: "no-store",
    credentials: "omit",
    headers: buildHeaders(false),
  });

  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }

  return res.json();
}

export async function apiPost<T = unknown>(
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    credentials: "omit",
    headers: buildHeaders(true),
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }

  return res.json();
}

export async function apiPut<T = unknown>(
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "PUT",
    credentials: "omit",
    headers: buildHeaders(true),
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }

  return res.json();
}

export async function apiDelete<T = unknown>(path: string): Promise<T> {
  const result = await apiDeleteWithMeta<T>(path);

  if (!result.ok) {
    throw new Error(result.error ?? `Request failed (${result.status})`);
  }

  return result.data as T;
}

export async function apiDeleteWithMeta<T = unknown>(path: string): Promise<{
  ok: boolean;
  status: number;
  data: T | string | null;
  error: string | null;
}> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "DELETE",
    credentials: "omit",
    headers: buildHeaders(false),
  });

  const data = await readResponsePayload(res);
  return {
    ok: res.ok,
    status: res.status,
    data: data as T | string | null,
    error: res.ok ? null : extractErrorMessage(data, res.status),
  };
}

export async function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const res = await fetch(`${BASE_URL}${path}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }

  return res.json() as Promise<T>;
}

export async function apiPostForm<T = unknown>(
  path: string,
  formData: FormData,
): Promise<T> {
  const token = getToken();

  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });

  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }

  return res.json();
}
