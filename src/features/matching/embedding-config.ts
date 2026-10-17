// Keep query inference, worker passages and the deployed vector(768) schema on the same E5 model.
export const EMBEDDING_MODEL = {
  id: 'intfloat/multilingual-e5-base',
  version: 'multilingual-e5-base-v1',
  dimensions: 768,
} as const;

export const VECTOR_TOP_K = 20;
