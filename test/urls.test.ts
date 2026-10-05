import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isAuthPopupUrl,
  isExternalUrl,
  isSmartsheetAppUrl,
  normalizeAppUrl,
  titleFromUrl,
} from "../src/urls.ts";

describe("isSmartsheetAppUrl", () => {
  it("accepts primary app hosts", () => {
    assert.equal(isSmartsheetAppUrl("https://app.smartsheet.com/"), true);
    assert.equal(isSmartsheetAppUrl("https://app.smartsheet.eu/sheets/1"), true);
    assert.equal(isSmartsheetAppUrl("https://app.smartsheet.au/"), true);
  });

  it("accepts smartsheet.com subdomains", () => {
    assert.equal(isSmartsheetAppUrl("https://www.smartsheet.com/help"), true);
  });

  it("rejects non-app hosts and junk", () => {
    assert.equal(isSmartsheetAppUrl("https://example.com"), false);
    assert.equal(isSmartsheetAppUrl("ftp://app.smartsheet.com"), false);
    assert.equal(isSmartsheetAppUrl("not a url"), false);
  });
});

describe("isAuthPopupUrl", () => {
  it("detects login and SSO hosts", () => {
    assert.equal(isAuthPopupUrl("https://accounts.google.com/o/oauth2"), true);
    assert.equal(isAuthPopupUrl("https://login.microsoftonline.com/common"), true);
    assert.equal(isAuthPopupUrl("https://acme.okta.com/oauth2/v1/authorize"), true);
    assert.equal(isAuthPopupUrl("https://example.com/saml/login"), true);
  });

  it("returns false for normal app urls", () => {
    assert.equal(isAuthPopupUrl("https://app.smartsheet.com/b/home"), false);
  });
});

describe("isExternalUrl", () => {
  it("is true only when neither app nor auth", () => {
    assert.equal(isExternalUrl("https://github.com"), true);
    assert.equal(isExternalUrl("https://app.smartsheet.com"), false);
    assert.equal(isExternalUrl("https://accounts.google.com"), false);
  });
});

describe("normalizeAppUrl", () => {
  it("keeps smartsheet urls and falls back to home", () => {
    assert.equal(
      normalizeAppUrl("https://app.smartsheet.eu/sheets/9"),
      "https://app.smartsheet.eu/sheets/9"
    );
    assert.equal(normalizeAppUrl("https://evil.example"), "https://app.smartsheet.com");
    assert.equal(normalizeAppUrl(null), "https://app.smartsheet.com");
    assert.equal(normalizeAppUrl(undefined), "https://app.smartsheet.com");
  });
});

describe("titleFromUrl", () => {
  it("maps known path prefixes", () => {
    assert.equal(titleFromUrl("https://app.smartsheet.com/sheets/1"), "Sheet");
    assert.equal(titleFromUrl("https://app.smartsheet.com/dashboards/1"), "Dashboard");
    assert.equal(titleFromUrl("https://app.smartsheet.com/reports/1"), "Report");
    assert.equal(titleFromUrl("https://app.smartsheet.com/workspaces/1"), "Workspace");
    assert.equal(titleFromUrl("https://app.smartsheet.com/folders/1"), "Home");
  });

  it("defaults for unknown or invalid urls", () => {
    assert.equal(titleFromUrl("https://app.smartsheet.com/other"), "Smartsheet");
    assert.equal(titleFromUrl("%%%"), "Smartsheet");
  });
});
