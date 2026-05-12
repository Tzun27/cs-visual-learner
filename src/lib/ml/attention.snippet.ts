export const attentionPython = `def attention(X, W_Q, W_K, W_V):
    # Project each token to its query, key, and value representations
    Q = X @ W_Q
    K = X @ W_K
    V = X @ W_V

    # Score: dot products of every query against every key
    S = Q @ K.T
    S = S / sqrt(d_k)        # scale to keep softmax sane

    # Softmax along the key dimension
    A = softmax(S, axis=-1)

    # Output: weighted sum of values per query
    Y = A @ V
    return Y
`;

export const attentionLines = {
  begin: [1],
  projectQ: [3],
  projectK: [4],
  projectV: [5],
  scores: [8],
  scale: [9],
  softmax: [12],
  weightedSum: [15],
  done: [16],
} as const;
