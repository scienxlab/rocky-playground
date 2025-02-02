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

import * as nn from "./nn";
import * as dataset from "./dataset";

/** Suffix added to the state when storing if a control is hidden or not. */
const HIDE_STATE_SUFFIX = "_hide";

/** A map between names and activation functions. */
export let activations: {[key: string]: nn.ActivationFunction} = {
  "relu": nn.Activations.RELU,
  "leakyrelu": nn.Activations.LeakyRELU,
  "elu": nn.Activations.ELU,
  "tanh": nn.Activations.TANH,
  "sigmoid": nn.Activations.SIGMOID,
  "swish": nn.Activations.SWISH,
  "mish": nn.Activations.MISH,
  "softplus": nn.Activations.SOFTPLUS,
  "gelu": nn.Activations.GELU,
  "linear": nn.Activations.LINEAR,
  "bent": nn.Activations.BENT_IDENTITY
};

/** A map between names and regularization functions. */
export let regularizations: {[key: string]: nn.RegularizationFunction} = {
  "none": null,
  "L1": nn.Regularizations.L1,
  "L2": nn.Regularizations.L2,
  "elastic net": nn.Regularizations.ElasticNet,
  "huber": nn.Regularizations.Huber
};

/** A map between names and eval functions. */
export let evals: {[key: string]: nn.EvalFunction} = {
  "f1": nn.Evals.F1,
  "mcc": nn.Evals.MATTHEWS_CORR_COEFF,
  "r2": nn.Evals.R2,
  "rmse": nn.Evals.RMSE
};

/** A map between names and loss functions. */
export let errors: {[key: string]: nn.ErrorFunction} = {
  "square": nn.Errors.SQUARE,
  "absolute": nn.Errors.ABS,
  "hinge": nn.Errors.HINGE,
  "squared hinge": nn.Errors.SQUARED_HINGE,
  "huber": nn.Errors.HUBER,
  "modified huber": nn.Errors.MODIFIED_HUBER,
  "cross entropy": nn.Errors.BINARY_CROSS_ENTROPY,
  "exponential": nn.Errors.EXPONENTIAL,
  "poisson": nn.Errors.POISSON,
  "epsilon insensitive": nn.Errors.EPSILON_INSENSITIVE
};

/** DatasetGenerator class contains generator functions for training and
 *  testing data. */
 class DatasetGenerator {
  trainGenerator: dataset.DataGenerator;
  testGenerator: dataset.DataGenerator;

  // if only one generator is supplied it is used for training and testing
  constructor(trainGenerator: dataset.DataGenerator,
              testGenerator ?: dataset.DataGenerator) {
    this.trainGenerator = trainGenerator;
    this.testGenerator = testGenerator == null ? trainGenerator : testGenerator;
  }

   equals(other: DatasetGenerator) {
     return (this.trainGenerator === other.trainGenerator &&
             this.testGenerator === other.testGenerator);
   }
}

/** A map between dataset names and the DatasetGenerator that contains
 *  functions to geneterate classification data. */
export let datasets: {[key: string]: DatasetGenerator} = {
  "linear": new DatasetGenerator(dataset.classifyLinearData),
  "moons": new DatasetGenerator(dataset.classifyMoonsData),
  "rocks": new DatasetGenerator(dataset.classifyRocksTrainData, dataset.classifyRocksTestData),
  "poroperm": new DatasetGenerator(dataset.classifyPoroPermTrainData, dataset.classifyPoroPermTestData),
  "circle": new DatasetGenerator(dataset.classifyCircleData),
  "xor": new DatasetGenerator(dataset.classifyXORData),
  "gauss": new DatasetGenerator(dataset.classifyTwoGaussData),
  "spiral": new DatasetGenerator(dataset.classifySpiralData),
  "diagonal": new DatasetGenerator(dataset.classifyDiagonalTrainData, dataset.classifyDiagonalTestData),
};

/** A map between dataset names and the DatasetGenerator that contains
 *  functions to geneterate regression data. */
 export let regDatasets: {[key: string]: DatasetGenerator} = {
  "reg-plane": new DatasetGenerator(dataset.regressPlane),
  "reg-gauss": new DatasetGenerator(dataset.regressGaussian),
  "reg-porosity": new DatasetGenerator(dataset.regressPorosityTrainData, dataset.regressPorosityTestData),
  "reg-dts": new DatasetGenerator(dataset.regressDtsTrainData, dataset.regressDtsTestData),
};

export function getKeyFromValue(obj: any, value: any): string {
  for (let key in obj) {
    if (value instanceof DatasetGenerator) {
      if (obj[key].equals(value)) {
        return key;
      }
    } else {
      if (obj[key] === value) {
        return key;
      }
    }
  }
  return undefined;
}

function endsWith(s: string, suffix: string): boolean {
  return s.substr(-suffix.length) === suffix;
}

function getHideProps(obj: any): string[] {
  let result: string[] = [];
  for (let prop in obj) {
    if (endsWith(prop, HIDE_STATE_SUFFIX)) {
      result.push(prop);
    }
  }
  return result;
}

/**
 * The data type of a state variable. Used for determining the
 * (de)serialization method.
 */
export enum Type {
  STRING,
  NUMBER,
  ARRAY_NUMBER,
  ARRAY_STRING,
  BOOLEAN,
  OBJECT
}

export enum Problem {
  CLASSIFICATION,
  REGRESSION
}

export let problems = {
  "classification": Problem.CLASSIFICATION,
  "regression": Problem.REGRESSION
};

export interface Property {
  name: string;
  type: Type;
  keyMap?: {[key: string]: any};
};

// Add the GUI state.
export class State {

  private static PROPS: Property[] = [
    {name: "activation", type: Type.OBJECT, keyMap: activations},
    {name: "regularization", type: Type.OBJECT, keyMap: regularizations},
    {name: "batchSize", type: Type.NUMBER},
    {name: "dataset", type: Type.OBJECT, keyMap: datasets},
    {name: "regDataset", type: Type.OBJECT, keyMap: regDatasets},
    {name: "learningRate", type: Type.NUMBER},
    {name: "regularizationRate", type: Type.NUMBER},
    {name: "errorFunc", type: Type.OBJECT, keyMap: errors},
    {name: "problem", type: Type.OBJECT, keyMap: problems},
    {name: "noise", type: Type.NUMBER},
    {name: "networkShape", type: Type.ARRAY_NUMBER},
    {name: "seed", type: Type.STRING},
    {name: "showTestData", type: Type.BOOLEAN},
    {name: "discretize", type: Type.BOOLEAN},
    {name: "percTrainData", type: Type.NUMBER},
    {name: "x", type: Type.BOOLEAN},
    {name: "y", type: Type.BOOLEAN},
    {name: "xTimesY", type: Type.BOOLEAN},
    {name: "xSquared", type: Type.BOOLEAN},
    {name: "ySquared", type: Type.BOOLEAN},
    {name: "collectStats", type: Type.BOOLEAN},
    {name: "tutorial", type: Type.STRING},
    {name: "initZero", type: Type.BOOLEAN},
    {name: "hideText", type: Type.BOOLEAN}
  ];

  [key: string]: any;
  learningRate = 0.03;
  regularizationRate = 0.01;
  showTestData = false;
  noise = 0;
  batchSize = 10;
  discretize = false;
  tutorial: string = null;
  percTrainData = 50;
  activation = nn.Activations.SIGMOID;
  regularization: nn.RegularizationFunction = null;
  errorFunc = nn.Errors.SQUARE;
  problem = Problem.CLASSIFICATION;
  initZero = false;
  hideText = false;
  collectStats = false;
  numHiddenLayers = 1;
  hiddenLayerControls: any[] = [];
  networkShape: number[] = [4];
  x = true;
  y = true;
  xTimesY = false;
  xSquared = false;
  ySquared = false;
  dataset: DatasetGenerator = new DatasetGenerator(dataset.classifyCircleData);
  regDataset: DatasetGenerator = new DatasetGenerator(dataset.regressPlane);
  seed: string;

  /**
   * Deserializes the state from the url hash.
   */
  static deserializeState(): State {
    let map: {[key: string]: string} = {};
    for (let keyvalue of window.location.hash.slice(1).split("&")) {
      let [name, value] = keyvalue.split("=");
      map[name] = value;
    }
    let state = new State();

    function hasKey(name: string): boolean {
      return name in map && map[name] != null && map[name].trim() !== "";
    }

    function parseArray(value: string): string[] {
      return value.trim() === "" ? [] : value.split(",");
    }

    // Deserialize regular properties.
    State.PROPS.forEach(({name, type, keyMap}) => {
      switch (type) {
        case Type.OBJECT:
          if (keyMap == null) {
            throw Error("A key-value map must be provided for state " +
                "variables of type Object");
          }
          if (hasKey(name) && map[name] in keyMap) {
            state[name] = keyMap[map[name]];
          }
          break;
        case Type.NUMBER:
          if (hasKey(name)) {
            // The + operator is for converting a string to a number.
            state[name] = +map[name];
          }
          break;
        case Type.STRING:
          if (hasKey(name)) {
            state[name] = map[name];
          }
          break;
        case Type.BOOLEAN:
          if (hasKey(name)) {
            state[name] = (map[name] === "false" ? false : true);
          }
          break;
        case Type.ARRAY_NUMBER:
          if (name in map) {
            state[name] = parseArray(map[name]).map(Number);
          }
          break;
        case Type.ARRAY_STRING:
          if (name in map) {
            state[name] = parseArray(map[name]);
          }
          break;
        default:
          throw Error("Encountered an unknown type for a state variable");
      }
    });

    // Deserialize state properties that correspond to hiding UI controls.
    getHideProps(map).forEach(prop => {
      state[prop] = (map[prop] === "true") ? true : false;
    });
    state.numHiddenLayers = state.networkShape.length;
    if (state.seed == null) {
      state.seed = Math.random().toFixed(5);
    }
    Math.seedrandom(state.seed);
    return state;
  }

  /**
   * Serializes the state into the url hash.
   */
  serialize() {
    // Serialize regular properties.
    let props: string[] = [];
    State.PROPS.forEach(({name, type, keyMap}) => {
      let value = this[name];
      // Don't serialize missing values.
      if (value == null) {
        return;
      }
      if (type === Type.OBJECT) {
        value = getKeyFromValue(keyMap, value);
      } else if (type === Type.ARRAY_NUMBER ||
          type === Type.ARRAY_STRING) {
        value = value.join(",");
      }
      props.push(`${name}=${value}`);
    });
    // Serialize properties that correspond to hiding UI controls.
    getHideProps(this).forEach(prop => {
      props.push(`${prop}=${this[prop]}`);
    });
    window.location.hash = props.join("&");
  }

  /** Returns all the hidden properties. */
  getHiddenProps(): string[] {
    let result: string[] = [];
    for (let prop in this) {
      if (endsWith(prop, HIDE_STATE_SUFFIX) && String(this[prop]) === "true") {
        result.push(prop.replace(HIDE_STATE_SUFFIX, ""));
      }
    }
    return result;
  }

  setHideProperty(name: string, hidden: boolean) {
    this[name + HIDE_STATE_SUFFIX] = hidden;
  }
}
