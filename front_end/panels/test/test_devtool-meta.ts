// Copyright (c) Meta Platforms, Inc. and affiliates.
// Copyright 2024 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.


// import modules that are used in this debugger
import * as i18n from '../../core/i18n/i18n.js';
import * as Root from '../../core/root/root.js';
import * as UI from '../../ui/legacy/legacy.js';

// import everything from the entrypoint
import type * as TestDevToolPanel from './test_devtool.js';

const UIStrings = {
  /**
   * @description Test DevTools panel title
   */
  title: 'Test DevTool',

  /**
   * @description Command for showing the Test DevTools panel
   */
  command: 'Show Test DevTool panel',
};

// register this file here
const str_ = i18n.i18n.registerUIStrings('panels/test/test_devtool-meta.ts', UIStrings);
const i18nLazyString = i18n.i18n.getLazilyComputedLocalizedString.bind(undefined, str_);

let loadedTestModule: (typeof TestDevToolPanel|undefined);

async function loadTestModule(): Promise<typeof TestDevToolPanel> {
  if (!loadedTestModule) {
    loadedTestModule = await import('./test_devtool.js');
  }
  return loadedTestModule;
}

// read more about this in ./front_end/ui/legacy/README.md
UI.ViewManager.registerViewExtension({
  location: UI.ViewManager.ViewLocationValues.PANEL,
  id: 'test-devtool', // this MUST be in kebab case
  title: i18nLazyString(UIStrings.title),
  commandPrompt: i18nLazyString(UIStrings.command),
  persistence: UI.ViewManager.ViewPersistence.PERMANENT,
  order: 1000,
  async loadView() {
    const Module = await loadTestModule();
    return new Module.TestDevToolView.TestDevToolView();
  },
  // you need to register this (per add_experiments.md)?
  experiment: Root.Runtime.ExperimentName.REACT_NATIVE_SPECIFIC_UI,
});

