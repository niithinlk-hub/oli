import type { FloydApi } from '../preload';

declare global {
  interface Window {
    floyd: FloydApi;
  }
}

export {};
