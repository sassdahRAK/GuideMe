import { PlaywrightCrawler } from 'crawlee';
import { extractInteractiveElements } from './dom-extractor.js';
import { createPathGraph, addEdge, addNode, markVisited, serializeGraph, generateStateChangedUrl } from './path-graph-builder.js';

/**
 * CrawleeDOMAnalyzer — Maps and tracks button destinations across a website.
 * Uses Crawlee + Playwright to crawl pages, click buttons, and record where each leads
 * (URL change, client-side route, or DOM mutation).
 */
export class CrawleeDOMAnalyzer {
  /**
   * @param {Object} options
   * @param {number} [options.maxRequestsPerCrawl=20] - Safety limit for crawl
   * @param {number} [options.clickTimeout=2000] - Timeout for button clicks
   * @param {number} [options.waitAfterClick=1000] - Wait time after click for DOM changes
   * @param {number} [options.domChangeThreshold=100] - DOM length change threshold to detect mutations
   * @param {boolean} [options.headless=true] - Run in headless mode
   */
  constructor(options = {}) {
    this.maxRequestsPerCrawl = options.maxRequestsPerCrawl ?? 20;
    this.clickTimeout = options.clickTimeout ?? 2000;
    this.waitAfterClick = options.waitAfterClick ?? 1000;
    this.domChangeThreshold = options.domChangeThreshold ?? 100;
    this.headless = options.headless ?? true;
    this.siteGraph = createPathGraph();
  }

  /**
   * Initialize and run the Crawlee crawler on the given URLs.
   * @param {string[]} startUrls - URLs to begin crawling from
   * @returns {Promise<Object>} The generated path graph
   */
  async run(startUrls) {
    this.siteGraph = createPathGraph();

    const crawler = new PlaywrightCrawler({
      maxRequestsPerCrawl: this.maxRequestsPerCrawl,
      headless: this.headless,
      async requestHandler({ page, request, enqueueLinks }) {
        await this._handleRequest(page, request, enqueueLinks);
      },
    });

    await crawler.run(startUrls);
    return this.getGraph();
  }

  /**
   * Handle a single page request: extract buttons, click each one, track destination.
   * @private
   */
  async _handleRequest(page, request, enqueueLinks) {
    const currentUrl = request.url;
    console.log(`Mapping page: ${currentUrl}`);

    // Mark as visited
    addNode(this.siteGraph, currentUrl);
    markVisited(this.siteGraph, currentUrl);

    // 1. Extract all interactive buttons on the current page
    const pageButtons = await extractInteractiveElements(page);

    // 2. Discover where each button leads
    for (const btn of pageButtons) {
      await this._processButton(page, btn, currentUrl, enqueueLinks);
    }
  }

  /**
   * Process a single button: determine its destination and record the edge.
   * @private
   */
  async _processButton(page, btn, currentUrl, enqueueLinks) {
    // If it's a standard link with an href, record the destination directly
    if (btn.href && !btn.href.startsWith('#') && !btn.href.startsWith('javascript:')) {
      try {
        const targetUrl = new URL(btn.href, currentUrl).href;

        addEdge(this.siteGraph, currentUrl, targetUrl, btn.text, 'navigation');

        // Add destination page to crawler queue
        await enqueueLinks({ urls: [targetUrl] });
      } catch (e) {
        console.warn(`Could not resolve href for button "${btn.text}": ${e.message}`);
      }
    } else {
      // If it's a dynamic button, track DOM changes without leaving the page
      await this._processDynamicButton(page, btn, currentUrl, enqueueLinks);
    }
  }

  /**
   * Process a dynamic button that doesn't have a direct href.
   * Clicks the button and tracks URL changes or DOM mutations.
   * @private
   */
  async _processDynamicButton(page, btn, currentUrl, enqueueLinks) {
    const beforeDomHash = await page.evaluate(() => document.body.innerHTML.length);

    try {
      const locator = page.locator('button, a, [role="button"]').nth(btn.index);
      await locator.click({ timeout: this.clickTimeout });
      await page.waitForTimeout(this.waitAfterClick);

      const newUrl = page.url();
      const afterDomHash = await page.evaluate(() => document.body.innerHTML.length);

      // Check if clicking altered URL or modified DOM state
      if (newUrl !== currentUrl) {
        addEdge(this.siteGraph, currentUrl, newUrl, btn.text, 'client_route');
        addNode(this.siteGraph, newUrl);
        markVisited(this.siteGraph, newUrl);

        // Add newly discovered page to the crawler queue
        await enqueueLinks({ urls: [newUrl] });
      } else if (Math.abs(afterDomHash - beforeDomHash) > this.domChangeThreshold) {
        const stateTargetUrl = generateStateChangedUrl(currentUrl, btn.text);
        addEdge(this.siteGraph, currentUrl, stateTargetUrl, btn.text, 'dom_mutation');
      }
    } catch (e) {
      console.warn(`Could not click button "${btn.text}": ${e.message}`);
    }
  }

  /**
   * Get the current path graph.
   * @returns {Object}
   */
  getGraph() {
    return {
      nodes: this.siteGraph.nodes,
      edges: this.siteGraph.edges,
    };
  }

  /**
   * Get the path graph as JSON string.
   * @returns {string}
   */
  getGraphJson() {
    return serializeGraph(this.siteGraph);
  }

  /**
   * Get all edges in the graph.
   * @returns {Array}
   */
  getEdges() {
    return this.siteGraph.edges;
  }

  /**
   * Get all nodes in the graph.
   * @returns {Array}
   */
  getNodes() {
    return this.siteGraph.nodes;
  }
}

/**
 * Convenience function to run the crawler and get the graph.
 * @param {string[]} startUrls
 * @param {Object} [options]
 * @returns {Promise<Object>}
 */
export async function crawlDom(startUrls, options) {
  const analyzer = new CrawleeDOMAnalyzer(options);
  return await analyzer.run(startUrls);
}
