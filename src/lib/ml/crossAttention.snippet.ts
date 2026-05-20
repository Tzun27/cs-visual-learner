export const crossAttentionPython = `def cross_attention(X_dec, X_enc, W_Q, W_K, W_V):
    # Queries come from the decoder (target) sequence
    Q = X_dec @ W_Q

    # Keys and values come from the encoder (source) sequence
    K = X_enc @ W_K
    V = X_enc @ W_V

    # Score: every decoder query against every encoder key
    S = Q @ K.T
    S = S / sqrt(d_k)        # scale to keep softmax sane

    # Softmax along the encoder (key) dimension
    A = softmax(S, axis=-1)

    # Output: one blended encoder value per decoder token
    Y = A @ V
    return Y
`;

export const crossAttentionLines = {
  begin: [1],
  projectQ: [3],
  projectK: [6],
  projectV: [7],
  scores: [10],
  scale: [11],
  softmax: [14],
  weightedSum: [17],
  done: [18],
} as const;
