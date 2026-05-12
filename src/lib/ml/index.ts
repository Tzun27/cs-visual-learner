export {
  bowlGradient,
  bowlLoss,
  gradientDescentSequence,
  type GradientDescentParams,
} from "./gradientDescent";
export { gradientDescentLines, gradientDescentPython } from "./gradientDescent.snippet";
export { backpropSequence, forwardLoss, type BackpropParams } from "./backprop";
export { backpropLines, backpropPython } from "./backprop.snippet";
export type {
  BackpropActivations,
  BackpropGradients,
  BackpropPhase,
  BackpropSnapshot,
  BackpropStep,
  BackpropWeights,
  GradientDescentSnapshot,
  GradientDescentStep,
  StepBase,
} from "./types";
