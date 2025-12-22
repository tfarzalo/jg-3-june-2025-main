import { Buffer } from 'buffer';
import process from 'process';

// Polyfill Buffer
if (typeof window !== 'undefined') {
  if (!window.Buffer) {
    window.Buffer = Buffer;
  }
  
  // Polyfill process
  if (!window.process) {
    window.process = process;
  }
  
  // Polyfill global (some libs expect it)
  if (!window.global) {
    window.global = window;
  }

  // Ensure process.nextTick exists (critical for streams)
  if (!window.process.nextTick) {
    window.process.nextTick = (cb: any, ...args: any[]) => {
      setTimeout(() => cb(...args), 0);
    };
  }
  
  console.log('✅ Polyfills applied: Buffer, global, process, nextTick');
}
