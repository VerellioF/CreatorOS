import type {
  PlatformCapabilities,
  PublishPayload,
  ValidationResult,
  UploadResult,
  ScheduleResult,
  PublishResult,
  PublishStatusCheckResult,
  ManualExportPackage,
  ConnectedAccountDetails,
  MockPublishOptions,
} from "./types";
import type { PublishingPlatform } from "@/lib/supabase/types";

export abstract class BasePublishingAdapter {
  abstract readonly platform: PublishingPlatform;

  abstract getCapabilities(): PlatformCapabilities;

  abstract validateContent(payload: PublishPayload): ValidationResult;

  abstract connectAccount(
    authCode: string,
    redirectUri: string
  ): Promise<ConnectedAccountDetails>;

  abstract disconnectAccount(accountId: string): Promise<boolean>;

  abstract uploadMedia(
    payload: PublishPayload,
    accessToken?: string
  ): Promise<UploadResult>;

  abstract schedulePost(
    uploadId: string,
    scheduledFor: Date,
    payload: PublishPayload,
    accessToken?: string
  ): Promise<ScheduleResult>;

  abstract publishPost(
    uploadId: string,
    payload: PublishPayload,
    accessToken?: string
  ): Promise<PublishResult>;

  abstract checkPublishStatus(
    externalPostId: string,
    options?: MockPublishOptions,
    accessToken?: string
  ): Promise<PublishStatusCheckResult>;

  abstract generateManualExportFallback(
    payload: PublishPayload
  ): ManualExportPackage;
}
