import { describe, it, expect } from 'vitest';
import { SqlClassifier, SqlRiskLevel } from '../src/core/security/sql-classifier';

describe('SqlClassifier', () => {
  it('classifies SELECT as SAFE', () => {
    const result = SqlClassifier.classify('SELECT * FROM users');
    expect(result.isSafe).toBe(true);
    expect(result.level).toBe(SqlRiskLevel.SAFE);
  });

  it('classifies INSERT as DANGEROUS', () => {
    const result = SqlClassifier.classify('INSERT INTO users (name) VALUES ("Test")');
    expect(result.isSafe).toBe(false);
    expect(result.level).toBe(SqlRiskLevel.DANGEROUS);
  });

  it('classifies DROP TABLE as DANGEROUS', () => {
    const result = SqlClassifier.classify('DROP TABLE users');
    expect(result.isSafe).toBe(false);
    expect(result.level).toBe(SqlRiskLevel.DANGEROUS);
  });

  it('classifies CTE WITH SELECT as SAFE', () => {
    const result = SqlClassifier.classify('WITH cte AS (SELECT * FROM a) SELECT * FROM cte');
    expect(result.isSafe).toBe(true);
    expect(result.level).toBe(SqlRiskLevel.SAFE);
  });

  it('classifies CTE WITH INSERT as DANGEROUS', () => {
    const result = SqlClassifier.classify('WITH cte AS (SELECT * FROM a) INSERT INTO b SELECT * FROM cte');
    expect(result.isSafe).toBe(false);
    expect(result.level).toBe(SqlRiskLevel.DANGEROUS);
  });

  it('handles comments', () => {
    const result = SqlClassifier.classify('-- This is a comment\nSELECT * FROM users');
    expect(result.isSafe).toBe(true);
  });
});
