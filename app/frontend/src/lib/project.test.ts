import { describe, expect, it } from 'vitest';
import { applyPatches, buildPreview, buildPreviewWithErrorHook, buildUserPrompt, parseOutput } from './project';

describe('parseOutput', () => {
  it('parses plan, files and summary', () => {
    const r = parseOutput('<plan>分析</plan>\n<file path="index.html"><html></html></file>\n<file path="style.css">body{}</file>\n完成');
    expect(r.plan).toBe('分析');
    expect(r.files).toEqual({ 'index.html': '<html></html>', 'style.css': 'body{}' });
    expect(r.writing).toBeNull();
    expect(r.summary).toBe('完成');
  });

  it('marks the unfinished file as writing while streaming', () => {
    const r = parseOutput('<plan>p</plan><file path="script.js">let a = 1');
    expect(r.writing).toBe('script.js');
    expect(r.files['script.js']).toBe('let a = 1');
  });

  it('returns partial plan before it is closed', () => {
    expect(parseOutput('<plan>正在分').plan).toBe('正在分');
  });

  it('strips markdown fences inside file content', () => {
    const r = parseOutput('<file path="a.js">\n```js\nx()\n```\n</file>');
    expect(r.files['a.js']).toBe('x()');
  });
});

describe('buildPreview', () => {
  const index =
    '<html><head><link rel="stylesheet" href="style.css"></head><body><script src="script.js"></script></body></html>';

  it('inlines linked css and js', () => {
    const out = buildPreview({ 'index.html': index, 'style.css': 'body{color:red}', 'script.js': 'console.log("</script>")' });
    expect(out).toContain('<style>\nbody{color:red}\n</style>');
    expect(out).not.toContain('href="style.css"');
    expect(out).not.toContain('src="script.js"');
    expect(out).toContain('<\\/script>');
  });

  it('appends assets that index.html does not reference', () => {
    const out = buildPreview({ 'index.html': '<html><head></head><body></body></html>', 'extra.css': 'a{}' });
    expect(out).toContain('<style>\na{}\n</style></head>');
  });

  it('injects the runtime error hook first in head', () => {
    const out = buildPreviewWithErrorHook({ 'index.html': index });
    expect(out.indexOf('atoms-preview-error')).toBeLessThan(out.indexOf('<link'));
  });
});

describe('buildUserPrompt', () => {
  it('creates a fresh request without files', () => {
    expect(buildUserPrompt('计算器', {})).toBe('请生成应用：计算器');
  });

  it('includes existing files and image hint for iterations', () => {
    const p = buildUserPrompt('改成深色', { 'index.html': '<p>x</p>' }, 2);
    expect(p).toContain('<file path="index.html"><p>x</p></file>');
    expect(p).toContain('附带 2 张参考图');
  });
});

describe('patches', () => {
  const text = `<plan>p</plan>
<patch path="a.js">
<<<<<<< SEARCH
let a = 1;
=======
let a = 2;
>>>>>>> REPLACE
<<<<<<< SEARCH
missing()
=======
x()
>>>>>>> REPLACE
</patch>
改好了`;

  it('parses patch blocks and summary', () => {
    const r = parseOutput(text);
    expect(r.patches).toHaveLength(2);
    expect(r.patches[0]).toEqual({ path: 'a.js', search: 'let a = 1;', replace: 'let a = 2;' });
    expect(r.summary).toBe('改好了');
  });

  it('applies matching patches and reports failures', () => {
    const r = applyPatches({ 'a.js': 'let a = 1;\nrun();' }, parseOutput(text).patches);
    expect(r.files['a.js']).toBe('let a = 2;\nrun();');
    expect(r.failed).toEqual(['a.js']);
  });

  it('marks an unclosed patch as writing', () => {
    expect(parseOutput('<patch path="b.css"><<<<<<< SEARCH').writing).toBe('b.css');
  });
});
