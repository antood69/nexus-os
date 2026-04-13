// Vercel serverless entry — loads the built Express app from dist/index.cjs
"use strict";

let initialized = false;
let initPromise = null;
let appHandler = null;

async function init() {
  const mod = require("../dist/index.cjs");
  appHandler = mod.app;
  if (mod.getInitPromise) {
    await mod.getInitPromise();
  }
  initialized = true;
}

module.exports = async function handler(req, res) {
  if (!initialized) {
    if (!initPromise) initPromise = init();
    await initPromise;
  }
  return appHandler(req, res);
};
