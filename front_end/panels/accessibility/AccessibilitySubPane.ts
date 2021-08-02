// Copyright 2020 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/* eslint-disable rulesdir/no_underscored_properties */

import accessibilityPropertiesStyles from './accessibilityProperties.css.js';
import type * as SDK from '../../core/sdk/sdk.js';
import * as UI from '../../ui/legacy/legacy.js';

export class AccessibilitySubPane extends UI.View.SimpleView {
  _axNode: SDK.AccessibilityModel.AccessibilityNode|null;
  _node?: SDK.DOMModel.DOMNode|null;
  constructor(name: string) {
    super(name);

    this._axNode = null;
  }

  setAXNode(_axNode: SDK.AccessibilityModel.AccessibilityNode|null): void {
  }

  node(): SDK.DOMModel.DOMNode|null {
    return this._node || null;
  }

  setNode(node: SDK.DOMModel.DOMNode|null): void {
    this._node = node;
  }

  createInfo(textContent: string, className?: string): Element {
    const classNameOrDefault = className || 'gray-info-message';
    const info = this.element.createChild('div', classNameOrDefault);
    info.textContent = textContent;
    return info;
  }

  createTreeOutline(): UI.TreeOutline.TreeOutline {
    const treeOutline = new UI.TreeOutline.TreeOutlineInShadow();
    treeOutline.registerRequiredCSS('panels/accessibility/accessibilityNode.css');
    treeOutline.registerRequiredCSS('panels/accessibility/accessibilityProperties.css');
    treeOutline.registerRequiredCSS('ui/legacy/components/object_ui/objectValue.css');

    treeOutline.element.classList.add('hidden');
    treeOutline.hideOverflow();
    this.element.appendChild(treeOutline.element);
    return treeOutline;
  }
  wasShown(): void {
    super.wasShown();
    this.registerCSSFiles([accessibilityPropertiesStyles]);
  }
}
