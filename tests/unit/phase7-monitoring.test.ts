import { describe, it, expect, vi, beforeEach } from "vitest";
import { ErrorTracker } from "@/lib/monitoring/error-tracker";

describe("Phase 7 Production Operations — Error Monitoring & Health Checks", () => {
  beforeEach(() => {
    ErrorTracker.clearBreadcrumbs();
    ErrorTracker.clearCapturedErrors();
  });

  it("captures errors, attaches breadcrumbs, and sanitizes sensitive data", () => {
    ErrorTracker.addBreadcrumb({
      category: "auth",
      message: "User initiated sign in",
      level: "info",
    });

    ErrorTracker.addBreadcrumb({
      category: "billing",
      message: "Checkout attempt",
      level: "info",
      data: {
        amount: 149000,
        cardNumber: "4111222233334444", // Should be sanitized
        clientSecret: "sk_live_secret_key_12345", // Should be sanitized
      },
    });

    const error = new Error("Payment gateway connection timed out");
    const eventId = ErrorTracker.captureException(error, {
      level: "error",
      tags: { service: "midtrans" },
      extra: {
        orderId: "ORDER-12345",
        password: "super_secret_password", // Should be sanitized
      },
    });

    expect(eventId).toBeTruthy();

    const captured = ErrorTracker.getCapturedErrors();
    expect(captured).toHaveLength(1);
    expect(captured[0].message).toBe("Payment gateway connection timed out");
    expect(captured[0].breadcrumbs).toHaveLength(2);

    // Verify sanitization
    const lastBreadcrumb = captured[0].breadcrumbs[1];
    expect(lastBreadcrumb.data?.cardNumber).toBe("[REDACTED]");
    expect(lastBreadcrumb.data?.clientSecret).toBe("[REDACTED]");

    expect(captured[0].extra?.password).toBe("[REDACTED]");
    expect(captured[0].extra?.orderId).toBe("ORDER-12345");
  });
});
