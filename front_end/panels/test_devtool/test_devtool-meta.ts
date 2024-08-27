// Copyright (c) Meta Platforms, Inc. and affiliates.
// Copyright 2020 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as i18n from '../../core/i18n/i18n.js';
import * as Root from '../../core/root/root.js';
import * as UI from '../../ui/legacy/legacy.js';

import type * as TestDevTool from './test_devtool.js';

const UIStrings = {
  /**
   * @description Title of the Welcome panel, plus an emoji symbolizing React Native
   */
  title: 'Test DevTool',

  /**
   * @description Command for showing the Welcome panel
   */
  showTestDevTool: 'Show Test DevTool panel',

  /**
   * @description The name of the debugging product.
   */
  debuggerBrandName: 'Test DevTools',
};
const str_ = i18n.i18n.registerUIStrings('panels/test_devtool/test_devtool-meta.ts', UIStrings);
const i18nLazyString = i18n.i18n.getLazilyComputedLocalizedString.bind(undefined, str_);

let loadedTestDevToolModule: (typeof TestDevTool|undefined);

async function loadTestDevToolModule(): Promise<typeof TestDevTool> {
  if (!loadedTestDevToolModule) {
    loadedTestDevToolModule = await import('./test_devtool.js');
  }
  return loadedTestDevToolModule;
}

UI.ViewManager.registerViewExtension({
  location: UI.ViewManager.ViewLocationValues.PANEL,
  id: 'test-devtool',
  title: i18nLazyString(UIStrings.title),
  commandPrompt: i18nLazyString(UIStrings.showTestDevTool),
  order: -10,
  persistence: UI.ViewManager.ViewPersistence.PERMANENT,
  async loadView() {
    const TestDevTool = await loadTestDevToolModule();
    return TestDevTool.TestDevTool.TestDevTool.instance({
      debuggerBrandName: i18nLazyString(UIStrings.debuggerBrandName),
      showBetaLabel: false,
      showDocs: true,
    });
  },
  experiment: Root.Runtime.ExperimentName.REACT_NATIVE_SPECIFIC_UI,
});
