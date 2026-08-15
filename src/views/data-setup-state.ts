import type { EditionValidationResult } from '@/game/data/data-validation';

export interface DataSetupValidationState {
  localActive: boolean;
  message: string;
  result?: EditionValidationResult;
  staticMessage?: string;
  staticResult?: EditionValidationResult;
}

export function readinessMessage(result: EditionValidationResult): string {
  return result.readiness === 'ready'
    ? `Ready from ${result.sourceLabel}.`
    : `Needs attention: ${result.readiness.replace('-', ' ')}.`;
}

export function applyStaticValidation(
  state: DataSetupValidationState,
  result: EditionValidationResult,
  localActive: boolean,
): void {
  state.staticResult = result;
  state.localActive = localActive;
  if (localActive) {
    state.staticMessage = `${readinessMessage(result)} Your selected local folder remains active for gameplay.`;
    return;
  }

  state.result = result;
  state.message = readinessMessage(result);
  state.staticMessage = undefined;
}
