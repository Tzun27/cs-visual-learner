export const gradientDescentPython = `def gradient_descent(w, lr, max_steps, tol):
    for step in range(max_steps):
        grad = compute_gradient(w)
        if norm(grad) < tol:
            return w  # converged
        w = w - lr * grad
    return w  # max steps reached
`;

export const gradientDescentLines = {
  begin: [1, 2],
  computeGradient: [3],
  applyUpdate: [6],
  converged: [4, 5],
  maxSteps: [7],
} as const;
