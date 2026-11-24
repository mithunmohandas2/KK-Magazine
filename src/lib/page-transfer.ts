import type { PageContent } from './data';

export const pageExportFormat = 'mozhi-pages';
export const pageExportVersion = 1;
export const maxPageExportPages = 250;
export const maxPageExportBytes = 3 * 1024 * 1024;

export function pageContent({ id, title, template, authors, blocks }: PageContent): PageContent {
  return { id, title, template, authors, blocks };
}
