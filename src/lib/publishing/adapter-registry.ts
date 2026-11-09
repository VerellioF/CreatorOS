import type { BasePublishingAdapter } from "./base-adapter";
import type { PlatformCapabilities } from "./types";
import type { PublishingPlatform } from "@/lib/supabase/types";
import { TikTokAdapter } from "./adapters/tiktok-adapter";
import { InstagramAdapter } from "./adapters/instagram-adapter";
import { YouTubeAdapter } from "./adapters/youtube-adapter";
import { FacebookAdapter } from "./adapters/facebook-adapter";
import { ShopeeVideoAdapter } from "./adapters/shopee-adapter";

export class PublishingRegistry {
  private static adapters: Map<PublishingPlatform, BasePublishingAdapter> =
    new Map<PublishingPlatform, BasePublishingAdapter>([
      ["tiktok", new TikTokAdapter()],
      ["instagram", new InstagramAdapter()],
      ["youtube", new YouTubeAdapter()],
      ["facebook", new FacebookAdapter()],
      ["shopee", new ShopeeVideoAdapter()],
    ]);

  static getAdapter(platform: PublishingPlatform): BasePublishingAdapter {
    const adapter = this.adapters.get(platform);
    if (!adapter) {
      throw new Error(`Platform adapter tidak ditemukan untuk: ${platform}`);
    }
    return adapter;
  }

  static getSupportedPlatforms(): PublishingPlatform[] {
    return Array.from(this.adapters.keys());
  }

  static getAllCapabilities(): PlatformCapabilities[] {
    return Array.from(this.adapters.values()).map((adapter) =>
      adapter.getCapabilities()
    );
  }

  static isPlatformDirectlyPublishable(platform: PublishingPlatform): boolean {
    const adapter = this.adapters.get(platform);
    return adapter ? adapter.getCapabilities().canPublishDirectly : false;
  }
}
