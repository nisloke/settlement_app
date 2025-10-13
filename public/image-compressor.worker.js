
// public/image-compressor.worker.js

// Note: The library needs to be accessible from the worker.
// We will use a dynamic import via a CDN for simplicity,
// as bundling workers and their dependencies can be complex.
self.importScripts('https://cdn.jsdelivr.net/npm/browser-image-compression@2.0.2/dist/browser-image-compression.js');

self.onmessage = async (event) => {
  const { file, options } = event.data;

  if (!file || !options) {
    self.postMessage({ error: 'File or options not provided.' });
    return;
  }

  try {
    // The browser-image-compression library is available globally in the worker
    // thanks to importScripts.
    const compressedFile = await imageCompression(file, options);
    self.postMessage({ compressedFile });
  } catch (error) {
    self.postMessage({ error: error.message });
  }
};
