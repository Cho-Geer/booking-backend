import { parseBooleanConfig } from './config.util';

describe('parseBooleanConfig', () => {
  it('parses common truthy values', () => {
    expect(parseBooleanConfig(true)).toBe(true);
    expect(parseBooleanConfig('true')).toBe(true);
    expect(parseBooleanConfig('1')).toBe(true);
    expect(parseBooleanConfig(1)).toBe(true);
  });

  it('parses common falsy values', () => {
    expect(parseBooleanConfig(false)).toBe(false);
    expect(parseBooleanConfig('false')).toBe(false);
    expect(parseBooleanConfig('0')).toBe(false);
    expect(parseBooleanConfig(0)).toBe(false);
    expect(parseBooleanConfig(undefined)).toBe(false);
  });

  it('falls back for unrecognized values', () => {
    expect(parseBooleanConfig('maybe', true)).toBe(true);
    expect(parseBooleanConfig('maybe', false)).toBe(false);
  });
});
