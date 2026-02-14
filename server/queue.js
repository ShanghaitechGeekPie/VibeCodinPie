/**
 * 📋 Prompt Queue Module
 * FIFO queue with max size limit for managing audience prompts
 */

export class PromptQueue {
  constructor(maxSize = 20) {
    this.maxSize = maxSize;
    this.queue = [];
  }

  /**
   * Add a prompt to the queue
   * @param {{ prompt: string, sessionId: string, ws: WebSocket }} item
   * @returns {number} Position in queue (1-based), or -1 if full
   */
  add(item) {
    if (this.queue.length >= this.maxSize) {
      return -1;
    }
    this.queue.push({
      ...item,
      timestamp: Date.now(),
    });
    return this.queue.length;
  }

  /**
   * Get and remove the next prompt from the queue
   * @returns {object|null}
   */
  next() {
    if (this.queue.length === 0) return null;
    return this.queue.shift();
  }

  /**
   * Get current queue size
   */
  size() {
    return this.queue.length;
  }

  /**
   * Clear the queue
   */
  clear() {
    this.queue = [];
  }

  /**
   * Get position of a session in the queue
   * @param {string} sessionId
   * @returns {number} Position (1-based), or -1 if not found
   */
  positionOf(sessionId) {
    const idx = this.queue.findIndex(item => item.sessionId === sessionId);
    return idx === -1 ? -1 : idx + 1;
  }
}
