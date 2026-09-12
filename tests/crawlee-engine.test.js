/**
 * Tests for @guideme/crawlee-engine
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { CrawleeDOMAnalyzer, createPathGraph, addEdge, addNode, markVisited, serializeGraph, generateStateChangedUrl } from '../packages/crawlee-engine/src/index.js';

describe('CrawleeDOMAnalyzer', () => {
  test('should instantiate with default options', () => {
    const analyzer = new CrawleeDOMAnalyzer();
    assert.strictEqual(analyzer.maxRequestsPerCrawl, 20);
    assert.strictEqual(analyzer.clickTimeout, 2000);
    assert.strictEqual(analyzer.waitAfterClick, 1000);
    assert.strictEqual(analyzer.domChangeThreshold, 100);
    assert.strictEqual(analyzer.headless, true);
  });

  test('should instantiate with custom options', () => {
    const analyzer = new CrawleeDOMAnalyzer({
      maxRequestsPerCrawl: 5,
      clickTimeout: 1000,
      waitAfterClick: 500,
      domChangeThreshold: 50,
      headless: false,
    });
    assert.strictEqual(analyzer.maxRequestsPerCrawl, 5);
    assert.strictEqual(analyzer.clickTimeout, 1000);
    assert.strictEqual(analyzer.waitAfterClick, 500);
    assert.strictEqual(analyzer.domChangeThreshold, 50);
    assert.strictEqual(analyzer.headless, false);
  });

  test('should return empty graph on initialization', () => {
    const analyzer = new CrawleeDOMAnalyzer();
    const graph = analyzer.getGraph();
    assert.deepStrictEqual(graph.nodes, []);
    assert.deepStrictEqual(graph.edges, []);
  });

  test('should return graph as JSON string', () => {
    const analyzer = new CrawleeDOMAnalyzer();
    const json = analyzer.getGraphJson();
    const parsed = JSON.parse(json);
    assert.deepStrictEqual(parsed.nodes, []);
    assert.deepStrictEqual(parsed.edges, []);
  });

  test('should return empty edges and nodes arrays', () => {
    const analyzer = new CrawleeDOMAnalyzer();
    assert.deepStrictEqual(analyzer.getEdges(), []);
    assert.deepStrictEqual(analyzer.getNodes(), []);
  });
});

describe('Path Graph Builder', () => {
  test('createPathGraph should return empty graph', () => {
    const graph = createPathGraph();
    assert.deepStrictEqual(graph.nodes, []);
    assert.deepStrictEqual(graph.edges, []);
  });

  test('addNode should add a node to the graph', () => {
    const graph = createPathGraph();
    addNode(graph, 'https://example.com');
    assert.strictEqual(graph.nodes.length, 1);
    assert.strictEqual(graph.nodes[0].url, 'https://example.com');
  });

  test('addNode should not duplicate nodes', () => {
    const graph = createPathGraph();
    addNode(graph, 'https://example.com');
    addNode(graph, 'https://example.com');
    assert.strictEqual(graph.nodes.length, 1);
  });

  test('addEdge should add an edge and ensure nodes exist', () => {
    const graph = createPathGraph();
    addEdge(graph, 'https://a.com', 'https://b.com', 'Click Me', 'navigation');
    assert.strictEqual(graph.edges.length, 1);
    assert.strictEqual(graph.edges[0].source, 'https://a.com');
    assert.strictEqual(graph.edges[0].target, 'https://b.com');
    assert.strictEqual(graph.edges[0].buttonText, 'Click Me');
    assert.strictEqual(graph.edges[0].type, 'navigation');
    assert.strictEqual(graph.nodes.length, 2);
  });

  test('addEdge should not duplicate edges', () => {
    const graph = createPathGraph();
    addEdge(graph, 'https://a.com', 'https://b.com', 'Click Me', 'navigation');
    addEdge(graph, 'https://a.com', 'https://b.com', 'Click Me', 'navigation');
    assert.strictEqual(graph.edges.length, 1);
  });

  test('markVisited should mark a node as visited', () => {
    const graph = createPathGraph();
    addNode(graph, 'https://example.com');
    markVisited(graph, 'https://example.com');
    assert.strictEqual(graph.nodes[0].visited, true);
  });

  test('serializeGraph should return valid JSON', () => {
    const graph = createPathGraph();
    addEdge(graph, 'https://a.com', 'https://b.com', 'Click', 'navigation');
    const json = serializeGraph(graph);
    const parsed = JSON.parse(json);
    assert.strictEqual(parsed.edges.length, 1);
  });

  test('generateStateChangedUrl should create correct URL', () => {
    const url = generateStateChangedUrl('https://example.com/page', 'Settings Modal');
    assert.strictEqual(url, 'https://example.com/page#state-changed-settings-modal');
  });

  test('generateStateChangedUrl should handle spaces in button text', () => {
    const url = generateStateChangedUrl('https://example.com', 'Open Settings');
    assert.strictEqual(url, 'https://example.com#state-changed-open-settings');
  });
});
