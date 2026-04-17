import { env } from "@/lib/env";

type ReqFrame = { type: "req"; id: string; method: string; params?: unknown };
type ResFrame = { type: "res"; id: string; ok: boolean; payload?: unknown; error?: { code: string; message: string; details?: unknown } };
type EventFrame = { type: "event"; event: string; payload?: unknown; seq?: number; stateVersion?: number };
type Frame = ReqFrame | ResFrame | EventFrame;

export type GatewayHelloOk = {
  type: "hello-ok";
  protocol: number;
  server: { version: string; connId: string };
  features: { methods: string[]; events: string[] };
  snapshot: unknown;
  canvasHostUrl?: string;
  auth?: { deviceToken: string; role: string; scopes: string[]; issuedAtMs?: number };
  policy: { maxPayload: number; maxBufferedBytes: number; tickIntervalMs: number };
};

export type GatewayConnectOptions = {
  url?: string;
  token?: string;
  role?: "operator" | "node" | string;
  scopes?: string[];
  client?: {
    id: string;
    version: string;
    platform: string;
    mode: "operator" | "node";
    displayName?: string;
  };
};

type Listener = (frame: EventFrame) => void;

function randomId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export class OpenClawGatewayClient {
  private ws: WebSocket | null = null;
  private url: string;
  private token?: string;
  private role: string;
  private scopes: string[];
  private client: GatewayConnectOptions["client"];

  private pending = new Map<string, { resolve: (v: any) => void; reject: (e: any) => void; timeoutId: number }>();
  private listeners = new Map<string, Set<Listener>>();
  private helloOk: GatewayHelloOk | null = null;

  private connected = false;
  private connecting = false;
  private reconnectTimer: number | null = null;
  private reconnectAttempts = 0;

  private lastTickAt = 0;
  private tickIntervalMs = 15_000;
  private tickWatchTimer: number | null = null;
  private lastClose: { code?: number; reason?: string; wasClean?: boolean } | null = null;

  constructor(opts: GatewayConnectOptions = {}) {
    this.url = (opts.url?.trim() || env.NEXT_PUBLIC_OPENCLAW_GATEWAY_WS_URL) as string;
    // If `token` is omitted, fall back to env. If the key is present (including ""), do not merge env.
    if (!("token" in opts)) {
      this.token = env.NEXT_PUBLIC_OPENCLAW_OPERATOR_TOKEN?.trim() || undefined;
    } else {
      const t = opts.token;
      this.token = t == null || t === "" ? undefined : String(t).trim() || undefined;
    }
    this.role = opts.role ?? "operator";
    this.scopes = opts.scopes ?? ["operator.read", "operator.write"];
    this.client = opts.client ?? { id: "mission-control", version: "0.1.0", platform: "web", mode: "operator" };
  }

  isConnected() {
    return this.connected;
  }

  getHelloOk() {
    return this.helloOk;
  }

  on(event: string, fn: Listener) {
    const set = this.listeners.get(event) ?? new Set<Listener>();
    set.add(fn);
    this.listeners.set(event, set);
    return () => {
      const s = this.listeners.get(event);
      s?.delete(fn);
    };
  }

  async connect(): Promise<GatewayHelloOk> {
    if (this.connected && this.helloOk) return this.helloOk;
    if (this.connecting) {
      return await new Promise((resolve, reject) => {
        const off = this.on("hello-ok", (evt) => {
          off();
          resolve(evt.payload as any);
        });
        const offErr = this.on("connect.error", (evt) => {
          offErr();
          reject(evt.payload);
        });
      });
    }

    this.connecting = true;
    this.helloOk = null;

    const ws = new WebSocket(this.url);
    this.ws = ws;

    ws.addEventListener("message", (msg) => this.handleMessage(String(msg.data)));
    ws.addEventListener("close", (evt) => this.handleClose(evt));
    ws.addEventListener("error", () => this.handleClose());

    await new Promise<void>((resolve, reject) => {
      const onOpen = () => {
        ws.removeEventListener("open", onOpen);
        resolve();
      };
      const onErr = () => {
        ws.removeEventListener("error", onErr);
        reject(new Error("WebSocket failed to open"));
      };
      ws.addEventListener("open", onOpen);
      ws.addEventListener("error", onErr);
    });

    // Protocol: first frame must be a connect request.
    // Some gateways emit `connect.challenge` immediately; we ignore it unless your deployment requires signed device identity.
    const connectReq: ReqFrame = {
      type: "req",
      id: randomId(),
      method: "connect",
      params: {
        minProtocol: 3,
        maxProtocol: 3,
        client: this.client,
        role: this.role,
        scopes: this.scopes,
        caps: [],
        commands: [],
        permissions: {},
        auth: this.token ? { token: this.token } : {}
      }
    };

    ws.send(JSON.stringify(connectReq));

    const res = await this.awaitHelloOk();
    this.connected = true;
    this.connecting = false;
    this.reconnectAttempts = 0;

    this.tickIntervalMs = Math.max(1_000, res.policy?.tickIntervalMs ?? 15_000);
    this.lastTickAt = Date.now();
    this.startTickWatchdog();

    return res;
  }

  disconnect() {
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopTickWatchdog();
    this.connected = false;
    this.connecting = false;
    this.helloOk = null;
    this.ws?.close();
    this.ws = null;
  }

  async rpc<TPayload = unknown>(method: string, params?: unknown, timeoutMs = 30_000): Promise<TPayload> {
    if (!this.ws) throw new Error("Gateway WS not connected");
    const id = randomId();
    const req: ReqFrame = { type: "req", id, method, params };
    const ws = this.ws;

    const p = new Promise<TPayload>((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Gateway RPC timeout: ${method}`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timeoutId });
    });

    ws.send(JSON.stringify(req));
    return await p;
  }

  private async awaitHelloOk(): Promise<GatewayHelloOk> {
    return await new Promise((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        reject(new Error("Timed out waiting for hello-ok"));
      }, 15_000);

      const offHello = this.on("hello-ok", (evt) => {
        window.clearTimeout(timeoutId);
        offHello();
        this.helloOk = evt.payload as any;
        resolve(evt.payload as any);
      });
    });
  }

  private emitEvent(event: string, payload?: unknown) {
    const frame: EventFrame = { type: "event", event, payload };
    const set = this.listeners.get(event);
    set?.forEach((fn) => fn(frame));
  }

  private handleMessage(raw: string) {
    let frame: Frame;
    try {
      frame = JSON.parse(raw);
    } catch {
      return;
    }

    if (frame.type === "event") {
      if (frame.event === "tick") this.lastTickAt = Date.now();
      if (frame.event === "hello-ok") this.helloOk = frame.payload as any;
      this.emitEvent(frame.event, frame.payload);
      return;
    }

    if (frame.type === "res") {
      const pending = this.pending.get(frame.id);
      if (pending) {
        window.clearTimeout(pending.timeoutId);
        this.pending.delete(frame.id);
        if (frame.ok) pending.resolve(frame.payload);
        else pending.reject(new Error(frame.error?.message ?? "Gateway RPC failed"));
      }
      const payloadType = (frame.payload as any)?.type;
      if (payloadType === "hello-ok") this.emitEvent("hello-ok", frame.payload);
      return;
    }
  }

  private handleClose(evt?: CloseEvent) {
    this.connected = false;
    this.connecting = false;
    this.stopTickWatchdog();

    if (evt) {
      this.lastClose = { code: evt.code, reason: evt.reason, wasClean: evt.wasClean };
      this.emitEvent("connect.close", this.lastClose);
    } else {
      this.emitEvent("connect.close", { code: undefined, reason: "unknown", wasClean: undefined });
    }

    for (const [id, pending] of this.pending.entries()) {
      window.clearTimeout(pending.timeoutId);
      pending.reject(new Error("Gateway disconnected"));
      this.pending.delete(id);
    }

    this.scheduleReconnect();
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    const backoffMs = Math.min(30_000, 500 * Math.pow(2, this.reconnectAttempts));
    this.reconnectAttempts += 1;
    this.reconnectTimer = window.setTimeout(async () => {
      this.reconnectTimer = null;
      try {
        await this.connect();
      } catch {
        this.scheduleReconnect();
      }
    }, backoffMs);
  }

  private startTickWatchdog() {
    this.stopTickWatchdog();
    const interval = Math.max(1_000, Math.min(60_000, this.tickIntervalMs));
    this.tickWatchTimer = window.setInterval(() => {
      const now = Date.now();
      const allowedGap = Math.max(2 * this.tickIntervalMs, 10_000);
      if (this.ws && this.connected && this.lastTickAt > 0 && now - this.lastTickAt > allowedGap) {
        try {
          this.ws.close(4000, "tick-timeout");
        } catch {
          // ignore
        }
      }
    }, interval);
  }

  private stopTickWatchdog() {
    if (this.tickWatchTimer) {
      window.clearInterval(this.tickWatchTimer);
      this.tickWatchTimer = null;
    }
  }
}

