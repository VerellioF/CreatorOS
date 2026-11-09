import type { PublishingPlatform } from "@/lib/supabase/types";

export interface PlatformCapabilities {
  platform: PublishingPlatform;
  displayName: string;
  canUpload: boolean;
  canSchedule: boolean;
  canPublishDirectly: boolean;
  requiresManualFallback: boolean;
  supportsReelsShorts: boolean;
  maxVideoDurationSec: number;
  maxCaptionLength: number;
  supportedMediaTypes: ("video" | "image" | "carousel")[];
  apiDocUrl: string;
  rateLimitPerDay: number;
}

export interface PublishPayload {
  title: string;
  caption: string;
  mediaUrl: string;
  mediaType: "video" | "image" | "carousel";
  aspectRatio: "9:16" | "16:9" | "1:1" | "4:5";
  durationSeconds?: number;
  coverUrl?: string;
  hashtags?: string[];
  privacyLevel?: "public" | "friends" | "private";
  scheduledFor?: string;
  productLinks?: string[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface UploadResult {
  uploadId: string;
  status: "uploaded" | "processing" | "failed";
  externalUri?: string;
  error?: string;
}

export interface ScheduleResult {
  scheduleId: string;
  scheduledFor: string;
  status: "scheduled" | "failed";
  error?: string;
}

export interface PublishResult {
  jobId: string;
  externalPostId: string;
  externalPostUrl?: string;
  status: "publishing" | "published" | "failed";
  isConfirmed: boolean;
  errorMessage?: string;
}

export interface PublishStatusCheckResult {
  status: "processing" | "published" | "failed";
  isConfirmed: boolean;
  externalPostUrl?: string;
  errorMessage?: string;
}

export interface ManualExportPackage {
  platform: PublishingPlatform;
  title: string;
  caption: string;
  downloadUrl: string;
  coverUrl?: string;
  instructions: string[];
  checklist: string[];
  recommendedHashtags: string[];
}

export interface ConnectedAccountDetails {
  accountId: string;
  accountName: string;
  avatarUrl?: string;
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
}

export interface MockPublishOptions {
  mockRemoteState?: string;
  mockErrorMessage?: string;
  mockPostUrl?: string;
}
