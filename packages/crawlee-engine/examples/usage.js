/**
 * GuideMe Crawlee DOM Analyzer — Usage Example
 * 
 * This demonstrates how to use @guideme/crawlee-engine to map
 * button destinations and generate a path graph for AI analysis.
 */

import { CrawleeDOMAnalyzer, crawlDom } from '@guideme/crawlee-engine';

// --- Option 1: Using the class directly ---
async function exampleClassUsage() {
  const analyzer = new CrawleeDOMAnalyzer({
    maxRequestsPerCrawl: 20,
    clickTimeout: 2000,
    waitAfterClick: 1000,
    domChangeThreshold: 100,
    headless: true,
  });

  const graph = await analyzer.run(['https://the-internet.herokuapp.com/']);

  console.log('\n--- GENERATED PATH GRAPH ---');
  console.log(JSON.stringify(graph, null, 2));
  console.log('\nNodes:', graph.nodes.length);
  console.log('Edges:', graph.edges.length);

  return graph;
}

// --- Option 2: Using the convenience function ---
async function exampleConvenienceUsage() {
  const graph = await crawlDom(['https://the-internet.herokuapp.com/'], {
    maxRequestsPerCrawl: 10,
    headless: true,
  });

  console.log('\n--- GENERATED PATH GRAPH (Convenience) ---');
  console.log(JSON.stringify(graph, null, 2));

  return graph;
}

// --- Option 3: Pass the graph to AI (Gemini) ---
async function exampleAiIntegration(graph) {
  // The graph can be passed to Gemini or any LLM
  const prompt = `Given this path graph, find the optimal path to change a password.`;
  
  console.log('\n--- AI PROMPT ---');
  console.log(`Page Graph has ${graph.nodes.length} pages and ${graph.edges.length} button actions.`);
  console.log('Pass this graph to Gemini for analysis:');
  console.log(JSON.stringify(graph, null, 2));
}

// Run examples
exampleClassUsage().catch(console.error);
// Or: exampleConvenienceUsage().catch(console.error);
