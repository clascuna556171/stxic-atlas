type RequestToken = { version: number; kind: string };
// Scope requests to an input revision, including A → B → A changes.
export class RequestTracker {
  private key = '';
  private version = 0;
  private active = new Map<string, RequestToken>();
  update(key: string) { if (key !== this.key) { this.key = key; this.version++; } }
  begin(kind: string): RequestToken | null {
    if (this.active.has(kind)) return null;
    const token = { kind, version: this.version };
    this.active.set(kind, token);
    return token;
  }
  current(token: RequestToken) { return token.version === this.version; }
  finish(token: RequestToken) { if (this.active.get(token.kind) === token) this.active.delete(token.kind); }
}
