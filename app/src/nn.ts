/* Copyright 2016 Google Inc. All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
==============================================================================*/

import Prism from 'prismjs';
import 'prismjs/components/prism-python';

/**
 * A node in a neural network. Each node has a state
 * (total input, output, and their respectively derivatives) which changes
 * after every forward and back propagation run.
 */
export class Node {
  id: string;
  /** List of input links. */
  inputLinks: Link[] = [];
  bias = 0.1;
  /** List of output links. */
  outputs: Link[] = [];
  totalInput: number;
  output: number;
  /** Error derivative with respect to this node's output. */
  outputDer = 0;
  /** Error derivative with respect to this node's total input. */
  inputDer = 0;
  /**
   * Accumulated error derivative with respect to this node's total input since
   * the last update. This derivative equals dE/db where b is the node's
   * bias term.
   */
  accInputDer = 0;
  /**
   * Number of accumulated err. derivatives with respect to the total input
   * since the last update.
   */
  numAccumulatedDers = 0;
  /** Activation function that takes total input and returns node's output */
  activation: ActivationFunction;

  /**
   * Creates a new node with the provided id and activation function.
   */
  constructor(id: string, activation: ActivationFunction, initZero?: boolean) {
    this.id = id;
    this.activation = activation;
    if (initZero) {
      this.bias = 0;
    }
  }

  /** Recomputes the node's output and returns it. */
  updateOutput(): number {
    // Stores total input into the node.
    this.totalInput = this.bias;
    for (let j = 0; j < this.inputLinks.length; j++) {
      let link = this.inputLinks[j];
      this.totalInput += link.weight * link.source.output;
    }
    this.output = this.activation.output(this.totalInput);
    return this.output;
  }


  compileToPy(): string {
    // Stores total input into the node.
    let py = this.bias.toPrecision(2) + "";
    for (let j = 0; j < this.inputLinks.length; j++) {
      let link = this.inputLinks[j];
      py += ` + (${link.weight.toPrecision(2)} * ${link.source.compileToPyName()})`;
    }
    return this.activation.compileToPy(py);
  }

  compileToPyName(): string {
    if (this.id == "x") {
      return "X1";
    } else if (this.id == "y") {
      return "X2";
    } else if (this.id == "xTimesY") {
      return "X1X2";
    } else if (this.id == "xSquared") {
      return "X1_squared";
    } else if (this.id == "ySquared") {
      return "X2_squared";
    } else if (this.id == "y") {
      return "X2";
    } else {
      return "a" + this.id;
    }
  }
}

/** An error function and its derivative. */
export interface ErrorFunction {
  error: (output: number, target: number) => number;
  der: (output: number, target: number) => number;
}
/** An eval function. */
export interface EvalFunction {
  eval: (output: number[], target: number[]) => number;
}

/** A node's activation function and its derivative. */
export interface ActivationFunction {
  output: (input: number) => number;
  der: (input: number) => number;
  compileToPy: (input: string) => string;
}

/** Function that computes a penalty cost for a given weight in the network. */
export interface RegularizationFunction {
  output: (weight: number) => number;
  der: (weight: number) => number;
}

export class Evals {
  public static F1: EvalFunction = {
    eval: (output: number[], target: number[]) => {
      const epsilon = 1e-10; // to avoid division by zero
      let tp = 0, fp = 0, fn = 0;
      
      for (let i = 0; i < output.length; i++) {
        const predicted = output[i] > 0 ? 1 : -1;
        const actual = target[i];

        if (predicted === 1 && actual === 1) {
          tp++;
        } else if (predicted === 1 && actual === -1) {
          fp++;
        } else if (predicted === -1 && actual === 1) {
          fn++;
        }
      }
      
      const precision = tp / (tp + fp + epsilon);
      const recall = tp / (tp + fn + epsilon);
      return 2 * (precision * recall) / (precision + recall + epsilon);
    }
  };

  public static MATTHEWS_CORR_COEFF: EvalFunction = {
    eval: (output: number[], target: number[]) => {
      let tp = 0, fp = 0, fn = 0, tn = 0;
      
      for (let i = 0; i < output.length; i++) {
        const predicted = output[i] > 0 ? 1 : -1;
        const actual = target[i];
        
        if (predicted === 1 && actual === 1) tp++;
        if (predicted === 1 && actual === -1) fp++;
        if (predicted === -1 && actual === 1) fn++;
        if (predicted === -1 && actual === -1) tn++;
      }
      
      const numerator = (tp * tn) - (fp * fn);
      const denominator = Math.sqrt((tp + fp) * (tp + fn) * (tn + fp) * (tn + fn));
      return denominator ? numerator / denominator : 0;
    }
  };
  
  public static R2: EvalFunction = {
    eval: (output: number[], target: number[]) => {
      let sumOfSquaresTotal = 0, sumOfSquaresResidual = 0;
      const meanTarget = target.reduce((acc, val) => acc + val, 0) / target.length;
      
      for (let i = 0; i < output.length; i++) {
        sumOfSquaresTotal += Math.pow(target[i] - meanTarget, 2);
        sumOfSquaresResidual += Math.pow(target[i] - output[i], 2);
      }
      
      return 1 - (sumOfSquaresResidual / sumOfSquaresTotal);
    }
  };
  
  public static RMSE: EvalFunction = {
    eval: (output: number[], target: number[]) => {
      let mse = 0;
      
      for (let i = 0; i < output.length; i++) {
        mse += Math.pow(output[i] - target[i], 2);
      }
      
      mse /= output.length;
      return Math.sqrt(mse);
    }
  };
}

/** Built-in error functions */
export class Errors {
  public static SQUARE: ErrorFunction = {
    error: (output: number, target: number) =>
               0.5 * Math.pow(output - target, 2),
    der: (output: number, target: number) => output - target
  };
  public static ABS: ErrorFunction = {
    error: (output: number, target: number) =>
      Math.abs(output - target),
    der: (output: number, target: number) => {
      if (output > target) return 1;
      if (output < target) return -1;
      return 0;
    }
  };
  public static HINGE: ErrorFunction = {
    error: (output: number, target: number) =>
      Math.max(0, 1 - output * target),
    der: (output: number, target: number) =>
      1 - output * target <= 0 ? 0 : -target
  };
  public static SQUARED_HINGE: ErrorFunction = {
    error: (output: number, target: number) => {
      // Call the HINGE error and square the result
      const hingeError = Errors.HINGE.error(output, target);
      return Math.pow(hingeError, 2); // Square the hinge loss
    },
    der: (output: number, target: number) => {
      const hingeDer = Errors.HINGE.der(output, target);
      return hingeDer <= 0 ? 0 : 2 * hingeDer; // Multiply by 2 :)
    }
  };
  public static HUBER: ErrorFunction = {
    error: (output: number, target: number) => {
      const delta = 1.0;
      const diff = output - target;
      return Math.abs(diff) <= delta
        ? 0.5 * diff * diff
        : delta * (Math.abs(diff) - 0.5 * delta);
    },
    der: (output: number, target: number) => {
      const delta = 1.0;
      const diff = output - target;
      return Math.abs(diff) <= delta 
        ? diff 
        : (diff > 0 ? delta : -delta);
    }
  };
  public static MODIFIED_HUBER: ErrorFunction = {
    error: (output: number, target: number) => {
      const hinge = Math.max(0, 1 - target * output); // Hinge loss term
      const squaredError = 0.5 * Math.pow(target - output, 2); // Squared error term
      return hinge + squaredError; // Combine both terms
    },
    der: (output: number, target: number) => {
      const hingeGrad = target * (output < 1 ? -1 : 0); // Derivative of the hinge loss
      const squaredErrorGrad = output - target; // Derivative of the squared error term
      return hingeGrad + squaredErrorGrad; // Combine the gradients
    }
  };
  public static BINARY_CROSS_ENTROPY: ErrorFunction = {
    error: (output: number, target: number) => {
      // Convert from (-1, +1) to (0, 1)
      const target01 = (target + 1) / 2;
      const output01 = (output + 1) / 2;
      return - (target01 * Math.log(output01) + (1 - target01) * Math.log(1 - output01));
    },
    der: (output: number, target: number) => {
      const target01 = (target + 1) / 2;
      const output01 = (output + 1) / 2;
      return (output01 - target01) / (output01 * (1 - output01));
    }
  };
  public static EXPONENTIAL: ErrorFunction = {
    error: (output: number, target: number) =>
      Math.exp(-output * target),
    der: (output: number, target: number) =>
      -target * Math.exp(-output * target)
  };
  public static POISSON: ErrorFunction = {
    error: (output: number, target: number) =>
      output - target * Math.log(output),
    der: (output: number, target: number) =>
      1 - target / output
  };
  public static EPSILON_INSENSITIVE: ErrorFunction = {
    error: (output: number, target: number) => {
      const epsilon = 0.1; // Example epsilon value
      const diff = Math.abs(output - target);
      return diff <= epsilon ? 0 : diff - epsilon;
    },
    der: (output: number, target: number) => {
      const epsilon = 0.1;
      const diff = output - target;
      if (Math.abs(diff) <= epsilon) {
        return 0;
      } else {
        return diff > 0 ? 1 : -1;
      }
    }
  };
}

/** Polyfill for TANH */
(Math as any).tanh = (Math as any).tanh || function(x) {
  if (x === Infinity) {
    return 1;
  } else if (x === -Infinity) {
    return -1;
  } else {
    let e2x = Math.exp(2 * x);
    return (e2x - 1) / (e2x + 1);
  }
};

/** Built-in activation functions */
export class Activations {
  public static TANH: ActivationFunction = {
    output: x => (Math as any).tanh(x),
    der: x => {
      let output = Activations.TANH.output(x);
      return 1 - output * output;
    },
    compileToPy: (input: string) => `math.tanh(${input})`
  };
  public static RELU: ActivationFunction = {
    output: x => Math.max(0, x),
    der: x => x <= 0 ? 0 : 1,
    compileToPy: (input: string) => `max(0, ${input})`
  };
  public static LeakyRELU: ActivationFunction = {
    output: x => x <= 0 ? 0.1 * x : x,
    der: x => x <= 0 ? 0.1 : 1,
    compileToPy: (input: string) => `max(0, ${input} * 0.1)`
  };
  public static ELU: ActivationFunction = {
    output: x => x <= 0 ? 0.1 * (Math.exp(x) - 1) : x,
    der: x => {
      let output = Activations.ELU.output(x);
      return output + 0.1;
    },
    compileToPy: (input: string) => `ELU(${input})`
  };
  public static SOFTPLUS: ActivationFunction = {
    output: x => Math.log(1 + Math.exp(x)),
    der: x => 1 / (1 + Math.exp(-x)),  // Sigmoid function
    compileToPy: (input: string) => `np.log(1 + np.exp(${input}))`
  };
  public static SIGMOID: ActivationFunction = {
    output: x => 1 / (1 + Math.exp(-x)),
    der: x => {
      let output = Activations.SIGMOID.output(x);
      return output * (1 - output);
    },
    compileToPy: (input: string) => `1 / (1 + math.exp(-(${input})))`
  };
  public static SWISH: ActivationFunction = {
    output: x => {
      let output = Activations.SIGMOID.output(x);
      return x * output;
    },
    der: x => {
      let output = Activations.SWISH.output(x);
      return output * (1 - output);
    },
    compileToPy: (input: string) => `${input} * SIGMOID(${input})`
  };
  public static MISH: ActivationFunction = {
    output: x => x * (Math as any).tanh(Math.log(1 + Math.exp(x))),
    der: x => {
      let omega = Math.exp(x);
      let delta = omega + 1;
      let tanhVal = (Math as any).tanh(Math.log(delta));
      return tanhVal + x * (omega / delta) * (1 - tanhVal * tanhVal);
    },
    compileToPy: (input: string) => `${input} * np.tanh(np.log(1 + np.exp(${input})))`
  };
  public static GELU: ActivationFunction = {
    output: x => {
      let term1 = x + 0.044715 * x**3;
      let term2 = 1 + (Math as any).tanh(Math.sqrt(2 / 3.14159265) * term1);
      return 0.5 * x * term2;
    },
    der: x => {
      let term1 = 0.398942 * x + 0.0535161 * x**3;
      let sech = 1 / (Math as any).cosh(0.797885 * x + 0.0356774 * x**3);
      let term2 = 0.5 * (Math as any).tanh(0.797885 * x + 0.0356774 * x**3);
      return 0.5 + term1 * sech**2 + term2;
    },
    compileToPy: (input: string) => `${input} * GELU(${input})`
  };
  public static LINEAR: ActivationFunction = {
    output: x => x,
    der: x => 1,
    compileToPy: (input: string) => `${input}`
  };
  public static BENT_IDENTITY: ActivationFunction = {
    output: x => (Math.sqrt(x * x + 1) - 1) / 2 + x,
    der: x => x / (2 * Math.sqrt(x * x + 1)) + 1,
    compileToPy: (input: string) => `(np.sqrt(${input}**2 + 1) - 1) / 2 + ${input}`
  };
}

/** Built-in regularization functions */
export class Regularizations {
  public static L1: RegularizationFunction = {
    output: w => Math.abs(w),
    der: w => w < 0 ? -1 : (w > 0 ? 1 : 0)
  };
  public static L2: RegularizationFunction = {
    output: w => 0.5 * w * w,
    der: w => w
  };
  public static ElasticNet: RegularizationFunction = {
    output: w => 0.5 * w * w + Math.abs(w),
    der: w => w + (w < 0 ? -1 : (w > 0 ? 1 : 0))
  };
  public static Huber: RegularizationFunction = {
    output: w => Math.abs(w) < 1 ? 0.5 * w * w : Math.abs(w) - 0.5,
    der: w => Math.abs(w) < 1 ? w : (w < 0 ? -1 : 1)
  };
}

/**
 * A link in a neural network. Each link has a weight and a source and
 * destination node. Also it has an internal state (error derivative
 * with respect to a particular input) which gets updated after
 * a run of back propagation.
 */
export class Link {
  id: string;
  source: Node;
  dest: Node;
  weight = Math.random() - 0.5;
  isDead = false;
  /** Error derivative with respect to this weight. */
  errorDer = 0;
  /** Accumulated error derivative since the last update. */
  accErrorDer = 0;
  /** Number of accumulated derivatives since the last update. */
  numAccumulatedDers = 0;
  regularization: RegularizationFunction;

  /**
   * Constructs a link in the neural network initialized with random weight.
   *
   * @param source The source node.
   * @param dest The destination node.
   * @param regularization The regularization function that computes the
   *     penalty for this weight. If null, there will be no regularization.
   */
  constructor(source: Node, dest: Node, initZero?: boolean) {
    this.id = source.id + "-" + dest.id;
    this.source = source;
    this.dest = dest;
    if (initZero) {
      this.weight = 0;
    }
  }
}

/**
 * Builds a neural network.
 *
 * @param networkShape The shape of the network. E.g. [1, 2, 3, 1] means
 *   the network will have one input node, 2 nodes in first hidden layer,
 *   3 nodes in second hidden layer and 1 output node.
 * @param activation The activation function of every hidden node.
 * @param outputActivation The activation function for the output nodes.
 * @param regularization The regularization function that computes a penalty
 *     for a given weight (parameter) in the network. If null, there will be
 *     no regularization.
 * @param inputIds List of ids for the input nodes.
 */
export function buildNetwork(
    networkShape: number[], activation: ActivationFunction,
    outputActivation: ActivationFunction,
    inputIds: string[], initZero?: boolean): Node[][] {
  let numLayers = networkShape.length;
  let id = 1;
  /** List of layers, with each layer being a list of nodes. */
  let network: Node[][] = [];
  for (let layerIdx = 0; layerIdx < numLayers; layerIdx++) {
    let isOutputLayer = layerIdx === numLayers - 1;
    let isInputLayer = layerIdx === 0;
    let currentLayer: Node[] = [];
    network.push(currentLayer);
    let numNodes = networkShape[layerIdx];
    for (let i = 0; i < numNodes; i++) {
      let nodeId = id.toString();
      if (isInputLayer) {
        nodeId = inputIds[i];
      } else {
        id++;
      }
      let node = new Node(nodeId,
          isOutputLayer ? outputActivation : activation, initZero);
      currentLayer.push(node);
      if (layerIdx >= 1) {
        // Add links from nodes in the previous layer to this node.
        for (let j = 0; j < network[layerIdx - 1].length; j++) {
          let prevNode = network[layerIdx - 1][j];
          let link = new Link(prevNode, node, initZero);
          prevNode.outputs.push(link);
          node.inputLinks.push(link);
        }
      }
    }
  }
  return network;
}

/**
 * Runs a forward propagation of the provided input through the provided
 * network. This method modifies the internal state of the network - the
 * total input and output of each node in the network.
 *
 * @param network The neural network.
 * @param inputs The input array. Its length should match the number of input
 *     nodes in the network.
 * @return The final output of the network.
 */
export function forwardProp(network: Node[][], inputs: number[]): number {
  let inputLayer = network[0];
  if (inputs.length !== inputLayer.length) {
    throw new Error("The number of inputs must match the number of nodes in" +
        " the input layer");
  }
  // Update the input layer.
  for (let i = 0; i < inputLayer.length; i++) {
    let node = inputLayer[i];
    node.output = inputs[i];
  }
  for (let layerIdx = 1; layerIdx < network.length; layerIdx++) {
    let currentLayer = network[layerIdx];
    // Update all the nodes in this layer.
    for (let i = 0; i < currentLayer.length; i++) {
      let node = currentLayer[i];
      node.updateOutput();
    }
  }
  return network[network.length - 1][0].output;
}

/**
 * Runs a backward propagation using the provided target and the
 * computed output of the previous call to forward propagation.
 * This method modifies the internal state of the network - the error
 * derivatives with respect to each node, and each weight
 * in the network.
 */
export function backProp(network: Node[][], target: number,
    errorFunc: ErrorFunction): void {
  // The output node is a special case. We use the user-defined error
  // function for the derivative.
  let outputNode = network[network.length - 1][0];
  outputNode.outputDer = errorFunc.der(outputNode.output, target);

  // Go through the layers backwards.
  for (let layerIdx = network.length - 1; layerIdx >= 1; layerIdx--) {
    let currentLayer = network[layerIdx];
    // Compute the error derivative of each node with respect to:
    // 1) its total input
    // 2) each of its input weights.
    for (let i = 0; i < currentLayer.length; i++) {
      let node = currentLayer[i];
      node.inputDer = node.outputDer * node.activation.der(node.totalInput);
      node.accInputDer += node.inputDer;
      node.numAccumulatedDers++;
    }

    // Error derivative with respect to each weight coming into the node.
    for (let i = 0; i < currentLayer.length; i++) {
      let node = currentLayer[i];
      for (let j = 0; j < node.inputLinks.length; j++) {
        let link = node.inputLinks[j];
        if (link.isDead) {
          continue;
        }
        link.errorDer = node.inputDer * link.source.output;
        link.accErrorDer += link.errorDer;
        link.numAccumulatedDers++;
      }
    }
    if (layerIdx === 1) {
      continue;
    }
    let prevLayer = network[layerIdx - 1];
    for (let i = 0; i < prevLayer.length; i++) {
      let node = prevLayer[i];
      // Compute the error derivative with respect to each node's output.
      node.outputDer = 0;
      for (let j = 0; j < node.outputs.length; j++) {
        let output = node.outputs[j];
        node.outputDer += output.weight * output.dest.inputDer;
      }
    }
  }
}

/**
 * Updates the weights of the network using the previously accumulated error
 * derivatives.
 */
export function updateWeights(network: Node[][], learningRate: number,
    regularization: RegularizationFunction, regularizationRate: number) {
  for (let layerIdx = 1; layerIdx < network.length; layerIdx++) {
    let currentLayer = network[layerIdx];
    for (let i = 0; i < currentLayer.length; i++) {
      let node = currentLayer[i];
      // Update the node's bias.
      if (node.numAccumulatedDers > 0) {
        node.bias -= learningRate * node.accInputDer / node.numAccumulatedDers;
        node.accInputDer = 0;
        node.numAccumulatedDers = 0;
      }
      // Update the weights coming into this node.
      for (let j = 0; j < node.inputLinks.length; j++) {
        let link = node.inputLinks[j];
        if (link.isDead) {
          continue;
        }
        let regulDer = regularization ?
            regularization.der(link.weight) : 0;
        if (link.numAccumulatedDers > 0) {
          // Update the weight based on dE/dw.
          link.weight = link.weight -
              (learningRate / link.numAccumulatedDers) * link.accErrorDer;
          // Further update the weight based on regularization.
          let newLinkWeight = link.weight -
              (learningRate * regularizationRate) * regulDer;
          if (regularization === Regularizations.L1 &&
              link.weight * newLinkWeight < 0) {
            // The weight crossed 0 due to the regularization term. Set it to 0.
            link.weight = 0;
            link.isDead = true;
          } else {
            link.weight = newLinkWeight;
          }
          link.accErrorDer = 0;
          link.numAccumulatedDers = 0;
        }
      }
    }
  }
}

/** Iterates over every node in the network/ */
export function forEachNode(network: Node[][], ignoreInputs: boolean,
    accessor: (node: Node) => any) {
  for (let layerIdx = ignoreInputs ? 1 : 0;
      layerIdx < network.length;
      layerIdx++) {
    let currentLayer = network[layerIdx];
    for (let i = 0; i < currentLayer.length; i++) {
      let node = currentLayer[i];
      accessor(node);
    }
  }
}

/** Returns the output node in the network. */
export function getOutputNode(network: Node[][]) {
  return network[network.length - 1][0];
}

// Originally authored by https://github.com/jameshfisher
// As part of dcato98's playground code
// Modified by Matt
// Returns a highlighted HTML string
export function compileNetworkToPy(network: Node[][]): string {
  const inputLayer = network[0];
  let py = `def forward(${inputLayer.map(node => node.compileToPyName()).join(", ")}):\n`;
  py += `    """Compute a forward pass of the network."""\n`;
  for (let layerIdx = 1; layerIdx < network.length; layerIdx++) {
    let currentLayer = network[layerIdx];
    for (let i = 0; i < currentLayer.length; i++) {
      let node = currentLayer[i];
      py += `    ${node.compileToPyName()} = ${node.compileToPy()}\n`;
    }
  }
  py += `    return ${network[network.length - 1][0].compileToPyName()}\n`;
  const html = Prism.highlight(py, Prism.languages.python, 'python');
  return html;
} 
