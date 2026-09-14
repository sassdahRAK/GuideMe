import googleDocsShareGuide from '../../../tutorials/google-docs/share-document-guide.json' with { type: 'json' };
import demoTestGuide from '../../../tutorials/general/welcome-tour.json' with { type: 'json' };
import spreadsheetDemoGuide from '../../../tutorials/spreadsheet/guideme-spreadsheet-demo.json' with { type: 'json' };
import { TutorialParser, type TutorialDefinition } from '@guideme/engine';

export interface CatalogTutorialItem extends TutorialDefinition {
  totalSteps: number;
  isMatched: boolean;
}

export const TUTORIAL_CATALOG: TutorialDefinition[] = [
  spreadsheetDemoGuide as TutorialDefinition,
  googleDocsShareGuide as TutorialDefinition,
  demoTestGuide as TutorialDefinition,
];

/**
 * Returns available tutorials categorized by match status for a URL.
 */
export function getTutorialsForUrl(url = ''): CatalogTutorialItem[] {
  return TUTORIAL_CATALOG.map((tut) => {
    const parseResult = TutorialParser.parse(tut);
    const isMatched = parseResult.success && TutorialParser.matchesUrl(parseResult.tutorial, url);
    return {
      ...tut,
      totalSteps: tut.steps?.length || 0,
      isMatched: Boolean(isMatched || tut.matchUrls?.includes('<all_urls>') || tut.matchUrls?.includes('*://*/*')),
    };
  });
}
