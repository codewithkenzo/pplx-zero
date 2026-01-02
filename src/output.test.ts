import { test, expect, describe } from 'bun:test';
import { fmt } from './output';

describe('fmt', () => {
  test('model formats with cyan color', () => {
    const result = fmt.model('sonar');
    expect(result).toContain('[sonar]');
    expect(result).toContain('\x1b[36m');
    expect(result).toContain('\x1b[0m');
  });

  test('searching shows dim text', () => {
    const result = fmt.searching();
    expect(result).toContain('Searching...');
    expect(result).toContain('\x1b[2m');
  });

  test('error formats with red color', () => {
    const result = fmt.error('test error');
    expect(result).toContain('Error: test error');
    expect(result).toContain('\x1b[31m');
  });

  test('citation formats with number and URL', () => {
    const result = fmt.citation(1, 'https://example.com');
    expect(result).toContain('1.');
    expect(result).toContain('https://example.com');
  });

  test('stats formats tokens and time', () => {
    const result = fmt.stats(100, 1500);
    expect(result).toContain('100 tokens');
    expect(result).toContain('1.5s');
  });

  test('sources shows yellow header', () => {
    const result = fmt.sources();
    expect(result).toContain('Sources:');
    expect(result).toContain('\x1b[33m');
  });
});
