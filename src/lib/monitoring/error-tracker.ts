export type ErrorLevel = "fatal" | "error" | "warning" | "info";

export interface Breadcrumb {
  timestamp: string;
  category: string;
  message: string;
  level: ErrorLevel;
  data?: Record<string, any>;
}

export interface CapturedErrorEvent {
  id: string;
  timestamp: string;
  message: string;
  name: string;
  stack?: string;
  level: ErrorLevel;
  tags?: Record<string, string>;
  extra?: Record<string, any>;
  breadcrumbs: Breadcrumb[];
}

export class ErrorTracker {
  private static breadcrumbs: Breadcrumb[] = [];
  private static capturedErrors: CapturedErrorEvent[] = [];
  private static maxBreadcrumbs = 50;

  private static sensitiveKeys = [
    "password",
    "secret",
    "token",
    "key",
    "cardnumber",
    "cvv",
    "clientsecret",
    "serverkey",
    "authorization",
  ];

  /**
   * Sanitizes object by replacing sensitive fields
   */
  static sanitize<T>(obj: T): T {
    if (!obj || typeof obj !== "object") return obj;
    if (Array.isArray(obj)) {
      return obj.map((item) => this.sanitize(item)) as unknown as T;
    }

    const cleaned: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj)) {
      const lowerKey = k.toLowerCase().replace(/[^a-z0-9]/g, "");
      const isSensitive = this.sensitiveKeys.some((s) => lowerKey.includes(s));
      if (isSensitive && typeof v === "string") {
        cleaned[k] = "[REDACTED]";
      } else if (typeof v === "object" && v !== null) {
        cleaned[k] = this.sanitize(v);
      } else {
        cleaned[k] = v;
      }
    }
    return cleaned as T;
  }

  /**
   * Adds a breadcrumb to the running session trace
   */
  static addBreadcrumb(crumb: Omit<Breadcrumb, "timestamp">): void {
    const sanitizedCrumb: Breadcrumb = {
      timestamp: new Date().toISOString(),
      category: crumb.category,
      message: crumb.message,
      level: crumb.level,
      data: crumb.data ? this.sanitize(crumb.data) : undefined,
    };

    this.breadcrumbs.push(sanitizedCrumb);
    if (this.breadcrumbs.length > this.maxBreadcrumbs) {
      this.breadcrumbs.shift();
    }
  }

  /**
   * Captures an exception and records a structured error event
   */
  static captureException(
    err: unknown,
    options?: {
      level?: ErrorLevel;
      tags?: Record<string, string>;
      extra?: Record<string, any>;
    }
  ): string {
    const eventId = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    let name = "Error";
    let message = "Unknown error occurred";
    let stack: string | undefined;

    if (err instanceof Error) {
      name = err.name;
      message = err.message;
      stack = err.stack;
    } else if (typeof err === "string") {
      message = err;
    }

    const event: CapturedErrorEvent = {
      id: eventId,
      timestamp,
      name,
      message,
      stack,
      level: options?.level || "error",
      tags: options?.tags,
      extra: options?.extra ? this.sanitize(options.extra) : undefined,
      breadcrumbs: [...this.breadcrumbs],
    };

    this.capturedErrors.push(event);

    // If external monitoring (like Sentry) is configured in production, forward it here
    if (process.env.NODE_ENV === "production") {
      console.error(`[ErrorTracker] [${event.level.toUpperCase()}] ${event.id}: ${event.message}`);
    }

    return eventId;
  }

  static getCapturedErrors(): CapturedErrorEvent[] {
    return [...this.capturedErrors];
  }

  static clearCapturedErrors(): void {
    this.capturedErrors = [];
  }

  static clearBreadcrumbs(): void {
    this.breadcrumbs = [];
  }
}
