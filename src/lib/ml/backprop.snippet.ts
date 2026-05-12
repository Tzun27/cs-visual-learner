export const backpropPython = `def backprop_one_step(x, t, w, lr):
    # Forward pass
    h1_pre = w.w11 * x[0] + w.w12 * x[1] + w.b1
    h1 = max(0, h1_pre)
    h2_pre = w.w21 * x[0] + w.w22 * x[1] + w.b2
    h2 = max(0, h2_pre)
    y = w.v1 * h1 + w.v2 * h2 + w.c

    # Loss (mean squared error, halved for a clean gradient)
    loss = 0.5 * (y - t) ** 2

    # Backward pass — apply the chain rule layer by layer
    dL_dy = y - t
    dL_dv1, dL_dv2, dL_dc = dL_dy * h1, dL_dy * h2, dL_dy
    dL_dh1_pre = dL_dy * w.v1 * (1 if h1_pre > 0 else 0)
    dL_dw11, dL_dw12, dL_db1 = dL_dh1_pre * x[0], dL_dh1_pre * x[1], dL_dh1_pre
    dL_dh2_pre = dL_dy * w.v2 * (1 if h2_pre > 0 else 0)
    dL_dw21, dL_dw22, dL_db2 = dL_dh2_pre * x[0], dL_dh2_pre * x[1], dL_dh2_pre

    # Apply the update: weight ← weight - lr * gradient
    return apply_update(w, lr, gradients)
`;

export const backpropLines = {
  begin: [1],
  forwardHidden1: [3, 4],
  forwardHidden2: [5, 6],
  forwardOutput: [7],
  computeLoss: [10],
  backwardOutput: [13, 14],
  backwardHidden1: [15, 16],
  backwardHidden2: [17, 18],
  applyUpdate: [21],
  done: [21],
} as const;
