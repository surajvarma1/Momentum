// Polyfill WebSocket for Node.js test environment if not present
if (typeof globalThis.WebSocket === 'undefined') {
  class MockWebSocket {
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSING = 2;
    static readonly CLOSED = 3;
    readyState = 1;
    onopen: any = null;
    onclose: any = null;
    onmessage: any = null;
    onerror: any = null;
    addEventListener() {}
    removeEventListener() {}
    send() {}
    close() {}
  }
  (globalThis as any).WebSocket = MockWebSocket;
}
