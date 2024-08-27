// Copyright (c) Meta Platforms, Inc. and affiliates.
// Copyright 2024 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import type * as Common from '../../core/common/common.js';
import * as UI from '../../ui/legacy/legacy.js';
import * as Host from '../../core/host/host.js';
import * as i18n from '../../core/i18n/i18n.js';
import * as SDK from '../../core/sdk/sdk.js';

import * as LitHtml from '../../ui/lit-html/lit-html.js';
import type * as Platform from '../../core/platform/platform.js';
import type * as Protocol from '../../generated/protocol.js';

const UIStrings = {
  /** @description Beta label */
  betaLabel: 'Beta!!!',
  /** @description Tech Preview label */
  techPreviewLabel: 'Tech Preview',
  /** @description Welcome text */
  welcomeMessage: 'Welcome to debugging in React Native',
  /** @description "Debugging docs" link */
  docsLabel: 'Debugging docs',
  /** @description "What's new" link */
  whatsNewLabel: "What's new",
  /** @description "Debugging Basics" title (docs item 1) */
  docsDebuggingBasics: 'Debugging Basics',
  /** @description "Debugging Basics" item detail */
  docsDebuggingBasicsDetail: 'Overview of debugging tools in React Native',
  /** @description "React DevTools" title (docs item 2 - pre-launch) */
  docsReactDevTools: 'React DevTools',
  /** @description "React DevTools" item detail */
  docsReactDevToolsDetail: 'Debug React components with React DevTools',
  /** @description "React Native DevTools" title (docs item 2 - post launch) */
  docsRNDevTools: 'React Native DevTools',
  /** @description "React Native DevTools" item detail */
  docsRNDevToolsDetail: 'Explore features available in React Native DevTools',
  /** @description "Native Debugging" title (docs item 3) */
  docsNativeDebugging: 'Native Debugging',
  /** @description "Native Debugging" item detail */
  docsNativeDebuggingDetail: 'Find out more about native debugging tools',
};
const {render, html} = LitHtml;

const str_ = i18n.i18n.registerUIStrings('panels/test_devtool/TestDevTool.ts', UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(undefined, str_);

let testDevToolInstance: TestDevTool;

type RNWelcomeOptions = {
  debuggerBrandName: () => Platform.UIString.LocalizedString,
  showBetaLabel?: boolean,
  showTechPreviewLabel?: boolean,
  showDocs?: boolean
};

export class TestDevTool extends UI.Widget.VBox implements
    SDK.TargetManager.SDKModelObserver<SDK.ReactNativeApplicationModel.ReactNativeApplicationModel> {
  private readonly options: RNWelcomeOptions;

  #reactNativeVersion: string|undefined;

  static instance(options: RNWelcomeOptions): TestDevTool {
    if (!testDevToolInstance) {
      testDevToolInstance = new TestDevTool(options);
    }
    return testDevToolInstance;
  }

  private constructor(options: RNWelcomeOptions) {
    super(true, true);

    this.options = options;

    SDK.TargetManager.TargetManager.instance().observeModels(
        SDK.ReactNativeApplicationModel.ReactNativeApplicationModel, this);
  }

  override wasShown(): void {
    super.wasShown();
    this.render();
    UI.InspectorView.InspectorView.instance().showDrawer({focus: true, hasTargetDrawer: false});
  }

  modelAdded(model: SDK.ReactNativeApplicationModel.ReactNativeApplicationModel): void {
    model.ensureEnabled();
    model.addEventListener(
        SDK.ReactNativeApplicationModel.Events.MetadataUpdated, this.#handleMetadataUpdated, this);
    this.#reactNativeVersion = model.metadataCached?.reactNativeVersion;
  }

  modelRemoved(model: SDK.ReactNativeApplicationModel.ReactNativeApplicationModel): void {
    model.removeEventListener(
        SDK.ReactNativeApplicationModel.Events.MetadataUpdated, this.#handleMetadataUpdated, this);
  }

  #handleMetadataUpdated(
      event: Common.EventTarget.EventTargetEvent<Protocol.ReactNativeApplication.MetadataUpdatedEvent>): void {
    this.#reactNativeVersion = event.data.reactNativeVersion;

    if (this.isShowing()) {
      this.render();
    }
  }

  render(): void {

    render(html`
      <div>
        hi test
      </div>
    `, this.contentElement, {host: this});
  }
}
