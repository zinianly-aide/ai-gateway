export class CostService {
  estimate(_provider: string, _model: string, inputTokens: number, outputTokens: number): number {
    // MVP: placeholder cost model; replace with provider/model pricing table later.
    const inputCostPer1k = 0;
    const outputCostPer1k = 0;
    return (inputTokens / 1000) * inputCostPer1k + (outputTokens / 1000) * outputCostPer1k;
  }
}
