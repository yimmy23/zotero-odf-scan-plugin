const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const DOCXScan = require('../../chrome/content/citationUtils.js');

// parsePandocCitationGroup() parses the content inside pandoc citation
// brackets, e.g. the "see @smith2020, p. 45; -@jones2019" part of
// [see @smith2020, p. 45; -@jones2019]. It splits on semicolons for
// multi-cite groups and extracts prefix, citekey, locator, suffix,
// and suppress-author flag from each entry.

describe('parsePandocCitationGroup', () => {
    it('"@smith2020" → single entry with citekey "smith2020", no extras', () => {
        const entries = DOCXScan.parsePandocCitationGroup('@smith2020');
        assert.equal(entries.length, 1);
        assert.equal(entries[0].citekey, 'smith2020');
        assert.equal(entries[0].prefix, '');
        assert.equal(entries[0].locator, '');
        assert.equal(entries[0].suffix, '');
        assert.equal(entries[0].suppressAuthor, false);
    });

    it('"@smith2020, p. 45" → citekey with page locator', () => {
        const entries = DOCXScan.parsePandocCitationGroup('@smith2020, p. 45');
        assert.equal(entries.length, 1);
        assert.equal(entries[0].citekey, 'smith2020');
        assert.equal(entries[0].locator, 'p. 45');
    });

    it('"-@smith2020" → suppress-author flag set to true', () => {
        const entries = DOCXScan.parsePandocCitationGroup('-@smith2020');
        assert.equal(entries.length, 1);
        assert.equal(entries[0].citekey, 'smith2020');
        assert.equal(entries[0].suppressAuthor, true);
    });

    it('"see @smith2020" → prefix "see" extracted from text before @', () => {
        const entries = DOCXScan.parsePandocCitationGroup('see @smith2020');
        assert.equal(entries.length, 1);
        assert.equal(entries[0].citekey, 'smith2020');
        assert.equal(entries[0].prefix, 'see');
    });

    it('"@smith2020; @jones2019" → two entries split on semicolon', () => {
        const entries = DOCXScan.parsePandocCitationGroup('@smith2020; @jones2019');
        assert.equal(entries.length, 2);
        assert.equal(entries[0].citekey, 'smith2020');
        assert.equal(entries[1].citekey, 'jones2019');
    });

    it('"see @smith2020, p. 45; -@jones2019, ch. 3" → full multi-cite with all features', () => {
        // First entry: prefix "see", page locator, no suppress-author
        // Second entry: suppress-author, chapter locator, no prefix
        const entries = DOCXScan.parsePandocCitationGroup('see @smith2020, p. 45; -@jones2019, ch. 3');
        assert.equal(entries.length, 2);
        assert.equal(entries[0].prefix, 'see');
        assert.equal(entries[0].locator, 'p. 45');
        assert.equal(entries[0].suppressAuthor, false);
        assert.equal(entries[1].citekey, 'jones2019');
        assert.equal(entries[1].suppressAuthor, true);
        assert.equal(entries[1].locator, 'ch. 3');
    });

    it('"@smith:2020a" → handles colons and letters in citekey', () => {
        const entries = DOCXScan.parsePandocCitationGroup('@smith:2020a');
        assert.equal(entries.length, 1);
        assert.equal(entries[0].citekey, 'smith:2020a');
    });

    it('"@smith2020; ; @jones2019" → empty parts between semicolons are skipped', () => {
        const entries = DOCXScan.parsePandocCitationGroup('@smith2020; ; @jones2019');
        assert.equal(entries.length, 2);
        assert.equal(entries[0].citekey, 'smith2020');
        assert.equal(entries[1].citekey, 'jones2019');
    });

    it('"see @smith2020 and others" → suffix "and others" captured without comma', () => {
        const entries = DOCXScan.parsePandocCitationGroup('see @smith2020 and others');
        assert.equal(entries.length, 1);
        assert.equal(entries[0].citekey, 'smith2020');
        assert.equal(entries[0].prefix, 'see');
        assert.equal(entries[0].suffix, 'and others');
        assert.equal(entries[0].locator, '');
    });

    it('"@smith2020, chap. 3" → label "chapter" passed through', () => {
        const entries = DOCXScan.parsePandocCitationGroup('@smith2020, chap. 3');
        assert.equal(entries.length, 1);
        assert.equal(entries[0].locator, 'ch. 3');
        assert.equal(entries[0].label, 'chapter');
    });

    // Pandoc's curly-brace forced-locator syntax:
    // https://pandoc.org/demo/example33/8.20-citation-syntax.html

    it('"@smith{ii, A, D-Z}, with a suffix" → braced text forced as locator, unrecognized prefix defaults to "page"', () => {
        const entries = DOCXScan.parsePandocCitationGroup('@smith{ii, A, D-Z}, with a suffix');
        assert.equal(entries.length, 1);
        assert.equal(entries[0].citekey, 'smith');
        assert.equal(entries[0].locator, 'ii, A, D-Z');
        assert.equal(entries[0].label, 'page');
        assert.equal(entries[0].suffix, 'with a suffix');
    });

    it('"@smith, {pp. iv, vi-xi, (xv)-(xvii)} with suffix here" → post-comma braces protect internal commas, recognized "pp." prefix still detected', () => {
        const entries = DOCXScan.parsePandocCitationGroup('@smith, {pp. iv, vi-xi, (xv)-(xvii)} with suffix here');
        assert.equal(entries.length, 1);
        assert.equal(entries[0].citekey, 'smith');
        assert.equal(entries[0].locator, 'p. iv, vi-xi, (xv)-(xvii)');
        assert.equal(entries[0].label, 'page');
        assert.equal(entries[0].suffix, 'with suffix here');
    });

    it('"@smith{}, 99 years later" → empty braces suppress locator parsing, remainder is suffix verbatim', () => {
        const entries = DOCXScan.parsePandocCitationGroup('@smith{}, 99 years later');
        assert.equal(entries.length, 1);
        assert.equal(entries[0].citekey, 'smith');
        assert.equal(entries[0].locator, '');
        assert.equal(entries[0].suffix, '99 years later');
    });

    it('"@smith{ch. 3}" → braced text matching a recognized prefix is still labeled "chapter"', () => {
        const entries = DOCXScan.parsePandocCitationGroup('@smith{ch. 3}');
        assert.equal(entries.length, 1);
        assert.equal(entries[0].locator, 'ch. 3');
        assert.equal(entries[0].label, 'chapter');
        assert.equal(entries[0].suffix, '');
    });
});
