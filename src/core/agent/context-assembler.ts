import { schemaIndexer } from './schema-indexer';
import { TableMetadata } from './types';

export class ContextAssembler {
  private stopWords = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'for', 'if', 'in', 'into', 'is', 'it', 
    'no', 'not', 'of', 'on', 'or', 'such', 'that', 'the', 'their', 'then', 'there', 'these', 'they', 
    'this', 'to', 'was', 'will', 'with', 'how', 'what', 'why', 'when', 'where', 'which', 'who', 'whom',
    'show', 'me', 'list', 'get', 'find', 'all', 'any', 'some', 'many', 'much', 'please', 'tell'
  ]);

  /**
   * Tokenize prompt into lowercase keywords, removing stop words and punctuation
   */
  private extractKeywords(prompt: string): string[] {
    const words = prompt.toLowerCase().split(/[^a-z0-9_\u4e00-\u9fa5]+/);
    return words.filter(word => word.length > 1 && !this.stopWords.has(word));
  }

  /**
   * Calculate a relevance score for a table given a list of keywords
   */
  private scoreTable(table: TableMetadata, keywords: string[]): number {
    let score = 0;
    const tableStr = [
      table.name,
      table.comment || '',
      ...table.columns.map(c => `${c.name} ${c.comment || ''}`)
    ].join(' ').toLowerCase();

    for (const keyword of keywords) {
      if (table.name.toLowerCase().includes(keyword)) {
        score += 10; // High weight for table name match
      } else if (table.comment?.toLowerCase().includes(keyword)) {
        score += 5; // Medium weight for table comment match
      } else if (tableStr.includes(keyword)) {
        score += 1; // Low weight for column or other match
      }
    }
    return score;
  }

  /**
   * Selects the most relevant tables and formats them into a prompt context string.
   */
  public assembleContext(
    prompt: string, 
    connectionId: string, 
    database: string, 
    schema?: string, 
    maxTables: number = 5
  ): { context: string; tablesUsed: string[] } {
    const index = schemaIndexer.getIndex(connectionId, database, schema);
    
    if (!index || index.tables.size === 0) {
      return { context: '', tablesUsed: [] };
    }

    const keywords = this.extractKeywords(prompt);
    
    // If no keywords, or index is small enough, just return top N tables (or all if < maxTables)
    let sortedTables: TableMetadata[] = [];
    
    if (keywords.length === 0) {
      sortedTables = Array.from(index.tables.values()).slice(0, maxTables);
    } else {
      const scoredTables = Array.from(index.tables.values()).map(table => ({
        table,
        score: this.scoreTable(table, keywords)
      }));

      // Sort by score descending
      scoredTables.sort((a, b) => b.score - a.score);

      // Filter tables that have at least some relevance, or just take top N
      // We will take top N tables that have score > 0, or if all 0, maybe just fallback
      const relevantTables = scoredTables.filter(t => t.score > 0);
      
      if (relevantTables.length > 0) {
        sortedTables = relevantTables.slice(0, maxTables).map(t => t.table);
      } else {
        // Fallback: just return up to maxTables if nothing matches well
        sortedTables = Array.from(index.tables.values()).slice(0, maxTables);
      }
    }

    // Format DDL
    const ddlStrings = sortedTables.map(t => t.ddl || '').filter(Boolean);
    const contextStr = ddlStrings.join('\n\n');

    return {
      context: contextStr,
      tablesUsed: sortedTables.map(t => t.name)
    };
  }
}

export const contextAssembler = new ContextAssembler();
