// Buffer polyfill
import { Buffer } from 'buffer/';
if (typeof window !== 'undefined') {
  // @ts-ignore
  window.Buffer = Buffer;
}

// Process polyfill
if (typeof window !== 'undefined') {
  // @ts-ignore
  window.process = {
    env: {
      NODE_ENV: 'production'
    }
  };
} 