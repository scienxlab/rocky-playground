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

import {Example2D} from "./dataset";
import * as d3 from 'd3';

export interface HeatMapSettings {
  [key: string]: any;
  showAxes?: boolean;
  noSvg?: boolean;
}

/** Number of different shades (colors) when drawing a gradient heatmap */
const NUM_SHADES = 30;

/**
 * Draws a heatmap using canvas. Used for showing the learned decision
 * boundary of the classification algorithm. Can also draw data points
 * using an svg overlayed on top of the canvas heatmap.
 */
export class HeatMap {
  private settings: HeatMapSettings = {
    showAxes: false,
    noSvg: false
  };
  private xScale;
  private yScale;
  private numSamples: number;
  private color;
  private canvas;
  private svg;
  private padding: number;
  private tooltip;
  /** Optional callback returning the model output at data coordinates (x, y);
   *  set via onValueHover() to show predictions on hover. */
  private valueProvider: (x: number, y: number) => number = null;
  /** Currently displayed points, so hover can report their target values. */
  private trainPoints: Example2D[] = [];
  private testPoints: Example2D[] = [];

  constructor(
      width: number, numSamples: number, xDomain: [number, number],
      yDomain: [number, number], container,
      userSettings?: HeatMapSettings) {
    this.numSamples = numSamples;
    let height = width;
    let padding = userSettings.showAxes ? 20 : 0;
    this.padding = padding;

    if (userSettings != null) {
      // overwrite the defaults with the user-specified settings.
      for (let prop in userSettings) {
        this.settings[prop] = userSettings[prop];
      }
    }

    this.xScale = d3.scale.linear()
      .domain(xDomain)
      .range([0, width - 2 * padding]);

    this.yScale = d3.scale.linear()
      .domain(yDomain)
      .range([height - 2 * padding, 0]);

    // Get a range of colors.
    let tmpScale = d3.scale.linear<string, number>()
        .domain([0, .5, 1])
        .range(["#325396", "#e8eaeb", "#04bdde"])
        .clamp(true);
    // Due to numerical error, we need to specify
    // d3.range(0, end + small_epsilon, step)
    // in order to guarantee that we will have end/step entries with
    // the last element being equal to end.
    let colors = d3.range(0, 1 + 1E-9, 1 / NUM_SHADES).map(a => {
      return tmpScale(a);
    });
    this.color = d3.scale.quantize()
                     .domain([-1, 1])
                     .range(colors);

    container = container.append("div")
      .style({
        width: `${width}px`,
        height: `${height}px`,
        position: "relative",
        top: `-${padding}px`,
        left: `-${padding}px`
      });
    this.canvas = container.append("canvas")
      .attr("width", numSamples)
      .attr("height", numSamples)
      .style("width", (width - 2 * padding) + "px")
      .style("height", (height - 2 * padding) + "px")
      .style("position", "absolute")
      .style("top", `${padding}px`)
      .style("left", `${padding}px`);

    if (!this.settings.noSvg) {
      this.svg = container.append("svg").attr({
          "width": width,
          "height": height
      }).style({
        // Overlay the svg on top of the canvas.
        "position": "absolute",
        "left": "0",
        "top": "0"
      }).append("g")
        .attr("transform", `translate(${padding},${padding})`);

      this.svg.append("g").attr("class", "train");
      this.svg.append("g").attr("class", "test");

      // Transparent overlay (beneath the point circles) that captures hover and
      // reports either the nearest point's target or the model output. Circles
      // are set to pointer-events:none so every move lands here.
      let plotWidth = width - 2 * padding;
      let plotHeight = height - 2 * padding;
      this.tooltip = container.append("div").attr("class", "heatmap-tooltip");
      this.svg.insert("rect", ":first-child")
        .attr({width: plotWidth, height: plotHeight})
        .style({fill: "none", "pointer-events": "all"})
        .on("mousemove", () => this.showHoverValue(d3.mouse(this.svg.node())))
        .on("mouseleave", () => this.tooltip.style("display", "none"));
    }

    if (this.settings.showAxes) {
      this.svg.append("g")
        .attr("class", "x axis")
        .attr("transform", `translate(0,${height - 2 * padding})`);

      this.svg.append("g")
        .attr("class", "y axis")
        .attr("transform", "translate(" + (width - 2 * padding) + ",0)");

      this.renderAxes();
    }
  }

  /**
   * Builds an axis with integer-only tick labels. Fractional ticks made the
   * (right-hand) labels too wide and they were clipped; integers also read
   * more cleanly. For small domains we place a tick at each integer; for wide
   * domains we let d3 choose nice (integer) ticks to avoid overcrowding.
   */
  private integerAxis(scale, orient: string) {
    let axis = d3.svg.axis().scale(scale).orient(orient)
        .tickFormat(d3.format("d"));
    let domain = scale.domain();
    let start = Math.ceil(Math.min(domain[0], domain[1]));
    let end = Math.floor(Math.max(domain[0], domain[1]));
    if (end - start <= 14) {
      let ticks = [];
      for (let v = start; v <= end; v++) {
        ticks.push(v);
      }
      axis.tickValues(ticks);
    }
    return axis;
  }

  private renderAxes() {
    if (!this.settings.showAxes || this.svg == null) {
      return;
    }
    this.svg.select("g.x.axis").call(this.integerAxis(this.xScale, "bottom"));
    this.svg.select("g.y.axis").call(this.integerAxis(this.yScale, "right"));
  }

  /**
   * Re-points the x/y scales at a new data domain and redraws the axes.
   * The grid resolution (numSamples) is unchanged, so a larger domain just
   * means each cell covers more of the data space - the cell count, and
   * therefore the cost of drawing the background, stays fixed.
   */
  updateDomain(xDomain: [number, number], yDomain: [number, number]): void {
    this.xScale.domain(xDomain);
    this.yScale.domain(yDomain);
    this.renderAxes();
  }

  /** Re-points the color scale at a new value domain (e.g. when the output
   *  scaling changes the range of the network output and labels). */
  updateColorDomain(domain: [number, number]): void {
    this.color.domain(domain);
  }

  /** Registers a callback that returns the model output at data coordinates,
   *  used to show predictions when hovering the heatmap background. */
  onValueHover(provider: (x: number, y: number) => number): void {
    this.valueProvider = provider;
  }

  /** Shows the target of the nearest data point, or (failing that) the model
   *  output at the hovered location. mouse is in the svg group's coordinates. */
  private showHoverValue(mouse: [number, number]) {
    let mx = mouse[0];
    let my = mouse[1];
    let points = this.trainPoints.concat(this.testPoints);
    let nearest: Example2D = null;
    let nearestDist = Infinity;
    for (let i = 0; i < points.length; i++) {
      let dx = this.xScale(points[i].x) - mx;
      let dy = this.yScale(points[i].y) - my;
      let dist = dx * dx + dy * dy;
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = points[i];
      }
    }
    let hitRadius = 6;
    let text: string;
    if (nearest != null && nearestDist <= hitRadius * hitRadius) {
      text = "target " + nearest.label.toFixed(3);
    } else if (this.valueProvider != null) {
      text = "output " +
          this.valueProvider(this.xScale.invert(mx), this.yScale.invert(my))
              .toFixed(3);
    } else {
      this.tooltip.style("display", "none");
      return;
    }
    this.tooltip.style({
      display: "block",
      left: `${mx + this.padding + 10}px`,
      top: `${my + this.padding + 10}px`
    }).text(text);
  }

  updateTestPoints(points: Example2D[]): void {
    if (this.settings.noSvg) {
      throw Error("Can't add points since noSvg=true");
    }
    this.testPoints = points;
    this.updateCircles(this.svg.select("g.test"), points);
  }

  updatePoints(points: Example2D[]): void {
    if (this.settings.noSvg) {
      throw Error("Can't add points since noSvg=true");
    }
    this.trainPoints = points;
    this.updateCircles(this.svg.select("g.train"), points);
  }

  updateBackground(data: number[][], discretize: boolean): void {
    let dx = data[0].length;
    let dy = data.length;

    if (dx !== this.numSamples || dy !== this.numSamples) {
      throw new Error(
          "The provided data matrix must be of size " +
          "numSamples X numSamples");
    }

    // Compute the pixel colors; scaled by CSS.
    let context = (this.canvas.node() as HTMLCanvasElement).getContext("2d");
    let image = context.createImageData(dx, dy);

    for (let y = 0, p = -1; y < dy; ++y) {
      for (let x = 0; x < dx; ++x) {
        let value = data[x][y];
        if (discretize) {
          value = (value >= 0 ? 1 : -1);
        }
        let c = d3.rgb(this.color(value));
        image.data[++p] = c.r;
        image.data[++p] = c.g;
        image.data[++p] = c.b;
        image.data[++p] = 160;
      }
    }
    context.putImageData(image, 0, 0);
  }

  private updateCircles(container, points: Example2D[]) {
    // Keep only points that are inside the bounds.
    let xDomain = this.xScale.domain();
    let yDomain = this.yScale.domain();
    points = points.filter(p => {
      return p.x >= xDomain[0] && p.x <= xDomain[1]
        && p.y >= yDomain[0] && p.y <= yDomain[1];
    });

    // Attach data to initially empty selection.
    let selection = container.selectAll("circle").data(points);

    // Insert elements to match length of points array. Circles don't capture
    // pointer events so the overlay rect handles all hover detection.
    selection.enter().append("circle").attr("r", 3)
        .style("pointer-events", "none");

    // Update points to be in the correct position.
    selection
      .attr({
        cx: (d: Example2D) => this.xScale(d.x),
        cy: (d: Example2D) => this.yScale(d.y),
      })
      .style("fill", d => this.color(d.label));

    // Remove points if the length has gone down.
    selection.exit().remove();
  }
}  // Close class HeatMap.

export function reduceMatrix(matrix: number[][], factor: number): number[][] {
  if (matrix.length !== matrix[0].length) {
    throw new Error("The provided matrix must be a square matrix");
  }
  if (matrix.length % factor !== 0) {
    throw new Error("The width/height of the matrix must be divisible by " +
        "the reduction factor");
  }
  let result: number[][] = new Array(matrix.length / factor);
  for (let i = 0; i < matrix.length; i += factor) {
    result[i / factor] = new Array(matrix.length / factor);
    for (let j = 0; j < matrix.length; j += factor) {
      let avg = 0;
      // Sum all the values in the neighborhood.
      for (let k = 0; k < factor; k++) {
        for (let l = 0; l < factor; l++) {
          avg += matrix[i + k][j + l];
        }
      }
      avg /= (factor * factor);
      result[i / factor][j / factor] = avg;
    }
  }
  return result;
}
