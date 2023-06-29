// Copyright 2014 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as Common from '../common/common.js';
import * as Platform from '../platform/platform.js';
import type * as Protocol from '../../generated/protocol.js';

import {ProfileNode, ProfileTreeModel} from './ProfileTreeModel.js';

export class CPUProfileNode extends ProfileNode {
  override id: number;
  override self: number;
  positionTicks: Protocol.Profiler.PositionTickInfo[]|undefined;
  override deoptReason: string|null;

  constructor(node: Protocol.Profiler.ProfileNode, sampleTime: number) {
    const callFrame = node.callFrame || ({
                        // TODO(crbug.com/1172300) Ignored during the jsdoc to ts migration
                        // @ts-expect-error
                        functionName: node['functionName'],
                        // TODO(crbug.com/1172300) Ignored during the jsdoc to ts migration
                        // @ts-expect-error
                        scriptId: node['scriptId'],
                        // TODO(crbug.com/1172300) Ignored during the jsdoc to ts migration
                        // @ts-expect-error
                        url: node['url'],
                        // TODO(crbug.com/1172300) Ignored during the jsdoc to ts migration
                        // @ts-expect-error
                        lineNumber: node['lineNumber'] - 1,
                        // TODO(crbug.com/1172300) Ignored during the jsdoc to ts migration
                        // @ts-expect-error
                        columnNumber: node['columnNumber'] - 1,
                      } as Protocol.Runtime.CallFrame);
    super(callFrame);
    this.id = node.id;
    this.self = (node.hitCount || 0) * sampleTime;
    this.positionTicks = node.positionTicks;
    // Compatibility: legacy backends could provide "no reason" for optimized functions.
    this.deoptReason = node.deoptReason && node.deoptReason !== 'no reason' ? node.deoptReason : null;
  }
}

export class CPUProfileDataModel extends ProfileTreeModel {
  profileStartTime: number;
  profileEndTime: number;
  timestamps: number[];
  samples: number[]|undefined;
  // TODO(crbug.com/1172300) Ignored during the jsdoc to ts migration
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  lines: any;
  totalHitCount: number;
  profileHead: CPUProfileNode;
  /**
   * A cache for the nodes we have parsed.
   * Note: "Parsed" nodes are different from the "Protocol" nodes, the
   * latter being the raw data we receive from the backend.
   */
  #idToParsedNode!: Map<number, CPUProfileNode>;
  gcNode!: CPUProfileNode;
  programNode?: ProfileNode;
  idleNode?: ProfileNode;
  #stackStartTimes?: Float64Array;
  #stackChildrenDuration?: Float64Array;
  constructor(profile: Protocol.Profiler.Profile) {
    super();
    // @ts-ignore Legacy types
    const isLegacyFormat = Boolean(profile['head']);
    if (isLegacyFormat) {
      // Legacy format contains raw timestamps and start/stop times are in seconds.
      this.profileStartTime = profile.startTime * 1000;
      this.profileEndTime = profile.endTime * 1000;
      // @ts-ignore Legacy types
      this.timestamps = profile.timestamps;
      this.compatibilityConversionHeadToNodes(profile);
    } else {
      // Current format encodes timestamps as deltas. Start/stop times are in microseconds.
      this.profileStartTime = profile.startTime / 1000;
      this.profileEndTime = profile.endTime / 1000;
      this.timestamps = this.convertTimeDeltas(profile);
    }
    this.samples = profile.samples;
    // @ts-ignore Legacy types
    this.lines = profile.lines;
    this.totalHitCount = 0;
    this.profileHead = this.translateProfileTree(profile.nodes);
    this.initialize(this.profileHead);
    this.extractMetaNodes();
    if (this.samples) {
      this.sortSamples();
      this.normalizeTimestamps();
      this.fixMissingSamples();
    }
  }

  private compatibilityConversionHeadToNodes(profile: Protocol.Profiler.Profile): void {
    // @ts-ignore Legacy types
    if (!profile.head || profile.nodes) {
      return;
    }
    const nodes: Protocol.Profiler.ProfileNode[] = [];
    // @ts-ignore Legacy types
    convertNodesTree(profile.head);
    profile.nodes = nodes;
    // @ts-ignore Legacy types
    delete profile.head;
    function convertNodesTree(node: Protocol.Profiler.ProfileNode): number {
      nodes.push(node);
      // @ts-ignore Legacy types
      node.children = (node.children as Protocol.Profiler.ProfileNode[]).map(convertNodesTree);
      return node.id;
    }
  }

  private convertTimeDeltas(profile: Protocol.Profiler.Profile): number[] {
    if (!profile.timeDeltas) {
      return [];
    }
    let lastTimeMicroSec = profile.startTime;
    const timestamps = new Array(profile.timeDeltas.length);
    for (let i = 0; i < profile.timeDeltas.length; ++i) {
      lastTimeMicroSec += profile.timeDeltas[i];
      timestamps[i] = lastTimeMicroSec;
    }
    return timestamps;
  }

  /**
   * Creates a Tree of CPUProfileNodes using the Protocol.Profiler.ProfileNodes.
   * As the tree is built, samples of native code (prefixed with "native ") are
   * filtered out. Samples of filtered nodes are replaced with the parent of the
   * node being filtered.
   *
   * This function supports legacy and new definitions of the CDP Profiler.Profile
   * type as well as the type of a CPU profile contained in trace events.
   */
  private translateProfileTree(nodes: Protocol.Profiler.ProfileNode[]): CPUProfileNode {
    function isNativeNode(node: Protocol.Profiler.ProfileNode): boolean {
      if (node.callFrame) {
        return Boolean(node.callFrame.url) && node.callFrame.url.startsWith('native ');
      }
      // @ts-ignore Legacy types
      return Boolean(node['url']) && node['url'].startsWith('native ');
    }

    function buildChildrenFromParents(nodes: Protocol.Profiler.ProfileNode[]): void {
      if (nodes[0].children) {
        return;
      }
      nodes[0].children = [];
      for (let i = 1; i < nodes.length; ++i) {
        const node = nodes[i];
        // @ts-ignore Legacy types
        const parentNode = protocolNodeById.get(node.parent);
        // @ts-ignore Legacy types
        if (parentNode.children) {
          // @ts-ignore Legacy types
          parentNode.children.push(node.id);
        } else {
          // @ts-ignore Legacy types
          parentNode.children = [node.id];
        }
      }
    }

    /**
     * Calculate how many times each node was sampled in the profile, if
     * not available in the profile data.
     */
    function buildHitCountFromSamples(nodes: Protocol.Profiler.ProfileNode[], samples: number[]|undefined): void {
      // If hit count is available, this profile has the new format, so
      // no need to continue.`
      if (typeof (nodes[0].hitCount) === 'number') {
        return;
      }
      if (!samples) {
        throw new Error('Error: Neither hitCount nor samples are present in profile.');
      }
      for (let i = 0; i < nodes.length; ++i) {
        nodes[i].hitCount = 0;
      }
      for (let i = 0; i < samples.length; ++i) {
        const node = protocolNodeById.get(samples[i]);
        if (!node || node.hitCount === undefined) {
          continue;
        }
        node.hitCount++;
      }
    }

    // A cache for the raw nodes received from the traces / CDP.
    const protocolNodeById = new Map<number, Protocol.Profiler.ProfileNode>();
    for (let i = 0; i < nodes.length; ++i) {
      const node = nodes[i];
      protocolNodeById.set(node.id, node);
    }

    buildHitCountFromSamples(nodes, this.samples);
    buildChildrenFromParents(nodes);
    this.totalHitCount = nodes.reduce((acc, node) => acc + (node.hitCount || 0), 0);
    const sampleTime = (this.profileEndTime - this.profileStartTime) / this.totalHitCount;
    const keepNatives =
        Boolean(Common.Settings.Settings.instance().moduleSetting('showNativeFunctionsInJSProfile').get());
    const root = nodes[0];
    // If a node is filtered out, its samples are replaced with its parent,
    // so we keep track of the which id to use in the samples data.
    const idToUseForRemovedNode = new Map<number, number>([[root.id, root.id]]);
    this.#idToParsedNode = new Map();

    const resultRoot = new CPUProfileNode(root, sampleTime);
    this.#idToParsedNode.set(root.id, resultRoot);
    if (!root.children) {
      throw new Error('Missing children for root');
    }
    const parentNodeStack = root.children.map(() => resultRoot);
    const sourceNodeStack = root.children.map(id => protocolNodeById.get(id));
    while (sourceNodeStack.length) {
      let parentNode = parentNodeStack.pop();
      const sourceNode = sourceNodeStack.pop();
      if (!sourceNode || !parentNode) {
        continue;
      }
      if (!sourceNode.children) {
        sourceNode.children = [];
      }
      const targetNode = new CPUProfileNode(sourceNode, sampleTime);
      if (keepNatives || !isNativeNode(sourceNode)) {
        parentNode.children.push(targetNode);
        parentNode = targetNode;
      } else {
        parentNode.self += targetNode.self;
      }

      idToUseForRemovedNode.set(sourceNode.id, parentNode.id);
      parentNodeStack.push.apply(parentNodeStack, sourceNode.children.map(() => parentNode as CPUProfileNode));
      sourceNodeStack.push.apply(sourceNodeStack, sourceNode.children.map(id => protocolNodeById.get(id)));
      this.#idToParsedNode.set(sourceNode.id, targetNode);
    }
    if (this.samples) {
      this.samples = this.samples.map(id => idToUseForRemovedNode.get(id) as number);
    }
    return resultRoot;
  }

  /**
   * Sorts the samples array using the timestamps array (there is a one
   * to one matching by index between the two).
   */
  private sortSamples(): void {
    if (!this.timestamps || !this.samples) {
      return;
    }

    const timestamps = this.timestamps;
    const samples = this.samples;
    const orderedIndices = timestamps.map((_x, index) => index);
    orderedIndices.sort((a, b) => timestamps[a] - timestamps[b]);

    this.timestamps = [];
    this.samples = [];

    for (let i = 0; i < orderedIndices.length; i++) {
      const orderedIndex = orderedIndices[i];
      this.timestamps.push(timestamps[orderedIndex]);
      this.samples.push(samples[orderedIndex]);
    }
  }

  /**
   * Fills in timestamps and/or time deltas from legacy profiles where
   * they could be missing.
   */
  private normalizeTimestamps(): void {
    if (!this.samples) {
      return;
    }
    let timestamps: number[] = this.timestamps;
    if (!timestamps) {
      // Support loading old CPU profiles that are missing timestamps.
      // Derive timestamps from profile start and stop times.
      const profileStartTime = this.profileStartTime;
      const interval = (this.profileEndTime - profileStartTime) / this.samples.length;
      // TODO(crbug.com/1172300) Ignored during the jsdoc to ts migration
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      timestamps = (new Float64Array(this.samples.length + 1) as any);
      for (let i = 0; i < timestamps.length; ++i) {
        timestamps[i] = profileStartTime + i * interval;
      }
      this.timestamps = timestamps;
      return;
    }

    // Convert samples from micro to milliseconds
    for (let i = 0; i < timestamps.length; ++i) {
      timestamps[i] /= 1000;
    }
    if (this.samples.length === timestamps.length) {
      // Support for a legacy format where there are no timeDeltas.
      // Add an extra timestamp used to calculate the last sample duration.
      const lastTimestamp = timestamps.at(-1) || 0;
      const averageIntervalTime = (lastTimestamp - timestamps[0]) / (timestamps.length - 1);
      this.timestamps.push(lastTimestamp + averageIntervalTime);
    }
    this.profileStartTime = timestamps.at(0) || this.profileStartTime;
    this.profileEndTime = timestamps.at(-1) || this.profileEndTime;
  }

  private extractMetaNodes(): void {
    const topLevelNodes = this.profileHead.children;
    for (let i = 0; i < topLevelNodes.length && !(this.gcNode && this.programNode && this.idleNode); i++) {
      const node = topLevelNodes[i];
      if (node.functionName === '(garbage collector)') {
        this.gcNode = (node as CPUProfileNode);
      } else if (node.functionName === '(program)') {
        this.programNode = node;
      } else if (node.functionName === '(idle)') {
        this.idleNode = node;
      }
    }
  }

  private fixMissingSamples(): void {
    // Sometimes the V8 sampler is not able to parse the JS stack and returns
    // a (program) sample instead. The issue leads to call frames being split
    // apart when they shouldn't.
    // Here's a workaround for that. When there's a single (program) sample
    // between two call stacks sharing the same bottom node, it is replaced
    // with the preceeding sample.
    const samples = this.samples;
    if (!samples) {
      return;
    }
    const samplesCount = samples.length;
    if (!this.programNode || samplesCount < 3) {
      return;
    }
    const idToNode = this.#idToParsedNode;
    const programNodeId = this.programNode.id;
    const gcNodeId = this.gcNode ? this.gcNode.id : -1;
    const idleNodeId = this.idleNode ? this.idleNode.id : -1;
    let prevNodeId: number = samples[0];
    let nodeId: number = samples[1];
    for (let sampleIndex = 1; sampleIndex < samplesCount - 1; sampleIndex++) {
      const nextNodeId = samples[sampleIndex + 1];
      if (nodeId === programNodeId && !isSystemNode(prevNodeId) && !isSystemNode(nextNodeId) &&
          bottomNode((idToNode.get(prevNodeId) as ProfileNode)) ===
              bottomNode((idToNode.get(nextNodeId) as ProfileNode))) {
        samples[sampleIndex] = prevNodeId;
      }
      prevNodeId = nodeId;
      nodeId = nextNodeId;
    }
    function bottomNode(node: ProfileNode): ProfileNode {
      while (node.parent && node.parent.parent) {
        node = node.parent;
      }
      return node;
    }
    function isSystemNode(nodeId: number): boolean {
      return nodeId === programNodeId || nodeId === gcNodeId || nodeId === idleNodeId;
    }
  }

  forEachFrame(
      openFrameCallback: (arg0: number, arg1: CPUProfileNode, arg2: number) => void,
      closeFrameCallback: (arg0: number, arg1: CPUProfileNode, arg2: number, arg3: number, arg4: number) => void,
      startTime?: number, stopTime?: number): void {
    if (!this.profileHead || !this.samples) {
      return;
    }

    startTime = startTime || 0;
    stopTime = stopTime || Infinity;
    const samples = this.samples;
    const timestamps = this.timestamps;
    const idToNode = this.#idToParsedNode;
    const gcNode = this.gcNode;
    const samplesCount = samples.length;
    const startIndex =
        Platform.ArrayUtilities.lowerBound(timestamps, startTime, Platform.ArrayUtilities.DEFAULT_COMPARATOR);
    let stackTop = 0;
    const stackNodes = [];
    let prevId: number = this.profileHead.id;
    let sampleTime;
    let gcParentNode: CPUProfileNode|null = null;

    // Extra slots for gc being put on top,
    // and one at the bottom to allow safe stackTop-1 access.
    const stackDepth = this.maxDepth + 3;
    if (!this.#stackStartTimes) {
      this.#stackStartTimes = new Float64Array(stackDepth);
    }
    const stackStartTimes = this.#stackStartTimes;
    if (!this.#stackChildrenDuration) {
      this.#stackChildrenDuration = new Float64Array(stackDepth);
    }
    const stackChildrenDuration = this.#stackChildrenDuration;

    let node;
    let sampleIndex;
    for (sampleIndex = startIndex; sampleIndex < samplesCount; sampleIndex++) {
      sampleTime = timestamps[sampleIndex];
      if (sampleTime >= stopTime) {
        break;
      }
      const id = samples[sampleIndex];
      if (id === prevId) {
        continue;
      }
      node = idToNode.get(id);
      let prevNode: CPUProfileNode = (idToNode.get(prevId) as CPUProfileNode);

      if (node === gcNode) {
        // GC samples have no stack, so we just put GC node on top of the last recorded sample.
        gcParentNode = prevNode;
        openFrameCallback(gcParentNode.depth + 1, gcNode, sampleTime);
        stackStartTimes[++stackTop] = sampleTime;
        stackChildrenDuration[stackTop] = 0;
        prevId = id;
        continue;
      }
      if (prevNode === gcNode && gcParentNode) {
        // end of GC frame
        const start = stackStartTimes[stackTop];
        const duration = sampleTime - start;
        stackChildrenDuration[stackTop - 1] += duration;
        closeFrameCallback(gcParentNode.depth + 1, gcNode, start, duration, duration - stackChildrenDuration[stackTop]);
        --stackTop;
        prevNode = gcParentNode;
        prevId = prevNode.id;
        gcParentNode = null;
      }

      while (node && node.depth > prevNode.depth) {
        stackNodes.push(node);
        node = node.parent;
      }

      // Go down to the LCA and close current intervals.
      while (prevNode !== node) {
        const start = stackStartTimes[stackTop];
        const duration = sampleTime - start;
        stackChildrenDuration[stackTop - 1] += duration;
        closeFrameCallback(
            prevNode.depth, (prevNode as CPUProfileNode), start, duration, duration - stackChildrenDuration[stackTop]);
        --stackTop;
        if (node && node.depth === prevNode.depth) {
          stackNodes.push(node);
          node = node.parent;
        }
        prevNode = (prevNode.parent as CPUProfileNode);
      }

      // Go up the nodes stack and open new intervals.
      while (stackNodes.length) {
        const currentNode = (stackNodes.pop() as CPUProfileNode);
        node = currentNode;
        openFrameCallback(currentNode.depth, currentNode, sampleTime);
        stackStartTimes[++stackTop] = sampleTime;
        stackChildrenDuration[stackTop] = 0;
      }

      prevId = id;
    }

    sampleTime = timestamps[sampleIndex] || this.profileEndTime;
    if (gcParentNode && idToNode.get(prevId) === gcNode) {
      const start = stackStartTimes[stackTop];
      const duration = sampleTime - start;
      stackChildrenDuration[stackTop - 1] += duration;
      closeFrameCallback(
          gcParentNode.depth + 1, (node as CPUProfileNode), start, duration,
          duration - stackChildrenDuration[stackTop]);
      --stackTop;
      prevId = gcParentNode.id;
    }
    for (let node = idToNode.get(prevId); node && node.parent; node = (node.parent as CPUProfileNode)) {
      const start = stackStartTimes[stackTop];
      const duration = sampleTime - start;
      stackChildrenDuration[stackTop - 1] += duration;
      closeFrameCallback(
          node.depth, (node as CPUProfileNode), start, duration, duration - stackChildrenDuration[stackTop]);
      --stackTop;
    }
  }

  /**
   * Returns the node that corresponds to a given index of a sample.
   */
  nodeByIndex(index: number): CPUProfileNode|null {
    return this.samples && this.#idToParsedNode.get(this.samples[index]) || null;
  }

  nodes(): CPUProfileNode[]|null {
    if (!this.#idToParsedNode) {
      return null;
    }
    return [...this.#idToParsedNode.values()];
  }
}
