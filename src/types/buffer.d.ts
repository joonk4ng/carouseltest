// buffer type declaration
declare global {
  interface Window {
    Buffer: typeof Buffer;
  }
}

export {}; 