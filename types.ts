
export type TransformationType = 'nullify' | 'smart';

export interface JSONState {
  input: string;
  output: string;
  error: string | null;
  fileName: string | null;
}
