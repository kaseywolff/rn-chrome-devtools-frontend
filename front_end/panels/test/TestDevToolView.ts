// Copyright (c) Meta Platforms, Inc. and affiliates.
// Copyright 2024 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as i18n from '../../core/i18n/i18n.js';
import * as UI from '../../ui/legacy/legacy.js';
import * as SDK from '../../core/sdk/sdk.js';
import * as Common from '../../core/common/common.js';
import * as Workspace from '../../models/workspace/workspace.js';

import * as LitHtml from '../../ui/lit-html/lit-html.js';

const UIStrings = {
  /**
   *@description Title of the Template DevTools view
   */
  title: 'Test DevTool',
};

const {render, html} = LitHtml;
const str_ = i18n.i18n.registerUIStrings('panels/test/TestDevToolView.ts', UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(undefined, str_);


export class TestDevToolViewImpl extends UI.Widget.VBox {

  constructor() {
    super(true, true);

    this.render();
  };

  render(): void {
    render(html`
      <div>
        hello test..
      </div>
    `, this.contentElement)
  }

};