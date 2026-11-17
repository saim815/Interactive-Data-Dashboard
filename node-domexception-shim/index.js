// Use platform's native DOMException or a clean fallback class
module.exports = globalThis.DOMException || class DOMException extends Error {
  constructor(message, name) {
    super(message);
    this.name = name || 'DOMException';
  }
};
