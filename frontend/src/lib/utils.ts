import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function extractApiError(err: unknown, fallback = 'An error occurred'): string {
  if (!err || typeof err !== 'object') return fallback;
  const axiosErr = err as { response?: { data?: Record<string, unknown> }; message?: string };
  const data = axiosErr.response?.data;
  if (!data) return axiosErr.message || fallback;
  if (typeof data.userMessage === 'string') return data.userMessage;
  if (typeof data.error === 'string') return data.error;
  const errObj = data.error as Record<string, unknown> | undefined;
  if (typeof errObj?.error_user_msg === 'string') return errObj.error_user_msg;
  if (typeof errObj?.message === 'string') return errObj.message;
  if (typeof data.message === 'string') return data.message;
  return fallback;
}
