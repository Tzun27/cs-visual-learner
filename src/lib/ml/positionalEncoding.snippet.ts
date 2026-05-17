export const positionalEncodingPython = `def add_positional_encoding(X):
    n, d = X.shape          # n = sequence length, d = embedding dim
    PE = zeros((n, d))
    for pos in range(n):
        for i in range(d // 2):
            denom = 10000 ** (2*i / d)
            PE[pos, 2*i]     = sin(pos / denom)
            PE[pos, 2*i + 1] = cos(pos / denom)
    return X + PE
`;

export const positionalEncodingLines = {
  begin: [1, 2, 3],
  // Walks the inner two lines that fill one row of PE.
  computeRow: [4, 5, 6, 7, 8],
  add: [9],
  done: [9],
} as const;
