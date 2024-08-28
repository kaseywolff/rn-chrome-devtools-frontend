import * as UI from '../../ui/legacy/legacy.js';
import * as SDK from '../../core/sdk/sdk.js';
import * as LitHtml from '../../ui/lit-html/lit-html.js';

const {render, html} = LitHtml;

declare global {
  interface Window {
    __REACT_DEVTOOLS_GLOBAL_HOOK__?: any
  }
}

export class TestDevTool extends UI.Widget.VBox implements SDK.TargetManager.SDKModelObserver<SDK.ReactNativeApplicationModel.ReactNativeApplicationModel> {
  constructor() {
    super(true, true);
    this.render();

    SDK.TargetManager.TargetManager.instance().observeModels(SDK.ReactNativeApplicationModel.ReactNativeApplicationModel, this);

    if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
      window.__REACT_DEVTOOLS_GLOBAL_HOOK__.on('customMessage', (message: any) => {
        console.log('TEST DEVTOOL: message received', message);
      });
      console.log('TEST DEVTOOL: window.__REACT_DEVTOOLS_GLOBAL_HOOK__ exists:', window);
    } else {
      console.log('TEST DEVTOOL: window.__REACT_DEVTOOLS_GLOBAL_HOOK__ does NOT exist');
    }
  }

  render(): void {
    render(html`
      <div>
        hello.
      </div>
    `, this.contentElement, {host: this});
  }

  modelAdded(model: SDK.ReactNativeApplicationModel.ReactNativeApplicationModel): void {
    console.log('TEST DEVTOOL: modelAdded');
  }

  modelRemoved(model: SDK.ReactNativeApplicationModel.ReactNativeApplicationModel): void {
    console.log('TEST DEVTOOL: modelRemoved');
  }
}
