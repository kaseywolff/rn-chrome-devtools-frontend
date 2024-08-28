import * as SDK from '../../core/sdk/sdk.js';
import * as UI from '../../ui/legacy/legacy.js';
import * as LitHtml from '../../ui/lit-html/lit-html.js';

const { render, html } = LitHtml;

export class TestDevTool extends UI.Widget.VBox implements
  SDK.TargetManager.SDKModelObserver<SDK.ReactNativeApplicationModel.ReactNativeApplicationModel> {

  constructor() {
    super(true, true);
    this.render();

    SDK.TargetManager.TargetManager.instance().observeModels(SDK.ReactNativeApplicationModel.ReactNativeApplicationModel, this);

    // Set up WebSocket or other communication method to receive messages
    this.setupWebSocket();
  }

  setupWebSocket() {
    console.log('TEST DEVTOOL: setupWebSocket')
    const socket = new WebSocket('ws://localhost:8081/debugger-frontend/test');
    socket.onmessage = (event) => {
      console.log('Message from React Native app:', event.data);
    };
  }

  render(): void {
    render(html`
      <div>
        hello.
      </div>
    `, this.contentElement, { host: this });
  }

  modelAdded(model: SDK.ReactNativeApplicationModel.ReactNativeApplicationModel): void {
    console.log('TEST DEVTOOL: modelAdded');
  }

  modelRemoved(model: SDK.ReactNativeApplicationModel.ReactNativeApplicationModel): void {
    console.log('TEST DEVTOOL: modelRemoved');
  }
}
