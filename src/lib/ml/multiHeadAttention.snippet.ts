export const multiHeadAttentionPython = `def multi_head_attention(X, W_Q_list, W_K_list, W_V_list, W_O):
    head_outputs = []
    for h in range(num_heads):
        Q_h = X @ W_Q_list[h]
        K_h = X @ W_K_list[h]
        V_h = X @ W_V_list[h]

        scores_h = Q_h @ K_h.T
        scaled_h = scores_h / sqrt(d_k)
        A_h = softmax(scaled_h, axis=-1)
        Y_h = A_h @ V_h

        head_outputs.append(Y_h)

    concat = np.concatenate(head_outputs, axis=-1)
    return concat @ W_O
`;

export const multiHeadAttentionLines = {
  begin: [1],
  projectQ: [4],
  projectK: [5],
  projectV: [6],
  scores: [8],
  scale: [9],
  softmax: [10],
  weightedSum: [11],
  appendHead: [13],
  concat: [15],
  projectOutput: [16],
  done: [16],
} as const;
