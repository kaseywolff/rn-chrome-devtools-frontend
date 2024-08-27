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

};
const {render, html} = LitHtml;

const str_ = i18n.i18n.registerUIStrings('panels/test_devtool/TestDevTool.ts', UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(undefined, str_);


export class TestDevTool extends UI.Widget.VBox implements
  SDK.TargetManager.SDKModelObserver<SDK.ReactNativeApplicationModel.ReactNativeApplicationModel> {

  constructor() {
    super(true, true);
    this.render();

    SDK.TargetManager.TargetManager.instance().observeModels(SDK.ReactNativeApplicationModel.ReactNativeApplicationModel, this);
  }


  render(): void {
    render(html`
      <div>
        hello world
      </div>
    `, this.contentElement, {host: this});
  }

  modelAdded(model: SDK.ReactNativeApplicationModel.ReactNativeApplicationModel): void {
    console.log('TEST DEVTOOL: modelAdded', model)
  };

  modelRemoved(model: SDK.ReactNativeApplicationModel.ReactNativeApplicationModel): void {
    console.log('TEST DEVTOOL: modelRemoved')
  };
}
