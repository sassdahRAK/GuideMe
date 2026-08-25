import googleDocsShareGuide from '../../../tutorials/google-docs/share-document-guide.json';
import demoTestGuide from '../../../tutorials/general/welcome-tour.json';
import { TutorialParser } from '@guideme/engine';

export const TUTORIAL_CATALOG = [
  googleDocsShareGuide,
  demoTestGuide,
];

/**
 * Returns available tutorials categorized by match status for a URL.
 * @param {string} url
 */
export function getTutorialsForUrl(url = '') {
  return TUTORIAL_CATALOG.map((tut) => {
    const parseResult = TutorialParser.parse(tut);
    const isMatched = parseResult.success && TutorialParser.matchesUrl(parseResult.tutorial, url);
    return {
      ...tut,
      totalSteps: tut.steps?.length || 0,
      isMatched: isMatched || tut.matchUrls?.includes('<all_urls>') || tut.matchUrls?.includes('*://*/*'),
    };
  });
}
