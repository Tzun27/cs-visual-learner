export const causalAttentionPython = `def causal_attention(X, W_Q, W_K, W_V):
    # Project each token to its query, key, and value representations
    Q = X @ W_Q
    K = X @ W_K
    V = X @ W_V

    # Score: dot products of every query against every key
    S = Q @ K.T
    S = S / sqrt(d_k)        # scale to keep softmax sane

    # Causal mask: token i may not look at tokens j > i.
    # Upper triangle becomes -inf; softmax(-inf) = 0.
    mask = triu(ones_like(S), diagonal=1)
    S = S.masked_fill(mask == 1, float("-inf"))

    # Softmax along the key dimension (masked entries collapse to 0)
    A = softmax(S, axis=-1)

    # Output: weighted sum of values per query (past + self only)
    Y = A @ V
    return Y
`;

export const causalAttentionLines = {
  begin: [1],
  projectQ: [3],
  projectK: [4],
  projectV: [5],
  scores: [8],
  scale: [9],
  mask: [11, 12, 13, 14],
  softmax: [17],
  weightedSum: [20],
  done: [21],
} as const;
