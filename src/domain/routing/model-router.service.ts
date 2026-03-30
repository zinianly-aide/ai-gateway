export class ModelRouterService {
  resolve(input: { provider?: string; model?: string }) {
    const provider = input.provider?.trim();
    const model = input.model?.trim() || '';

    if (provider) {
      return { provider, model };
    }

    if (model === 'dify-app' || model.startsWith('dify/')) {
      return { provider: 'dify', model };
    }

    if (model.startsWith('claude')) {
      return { provider: 'anthropic', model };
    }

    return { provider: 'openai', model };
  }

  listModels() {
    return [
      {
        id: 'dify-app',
        object: 'model',
        owned_by: 'dify',
        provider: 'dify'
      },
      {
        id: 'claude-3-5-sonnet',
        object: 'model',
        owned_by: 'anthropic',
        provider: 'anthropic'
      },
      {
        id: 'gpt-4o-mini',
        object: 'model',
        owned_by: 'openai-compatible',
        provider: 'openai'
      }
    ];
  }
}
