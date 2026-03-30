import type { ProviderAdapter } from './base/provider-adapter.js';

export class ProviderRegistry {
  private providers = new Map<string, ProviderAdapter>();

  registerProvider(adapter: ProviderAdapter) {
    this.providers.set(adapter.name, adapter);
  }

  getProvider(name: string) {
    const provider = this.providers.get(name);
    if (!provider) throw new Error(`Provider not found: ${name}`);
    return provider;
  }
}
