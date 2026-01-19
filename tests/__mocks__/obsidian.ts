export type Modifier = 'Ctrl' | 'Shift' | 'Alt' | 'Meta';

export class Notice {
  constructor(message: string, timeout?: number) {
    console.log(`Notice: ${message}`);
  }
}

export class Plugin {
  app: any;
  manifest: any;

  constructor(app: any, manifest: any) {
    this.app = app;
    this.manifest = manifest;
  }

  async loadData(): Promise<any> {
    return {};
  }

  async saveData(data: any): Promise<void> {
    // Mock save
  }
}

export class PluginSettingTab {
  app: any;
  plugin: any;
  containerEl: HTMLElement;

  constructor(app: any, plugin: any) {
    this.app = app;
    this.plugin = plugin;
    this.containerEl = document.createElement('div');
  }

  display(): void {
    // Mock display
  }

  hide(): void {
    // Mock hide
  }
}

export class Modal {
  app: any;
  contentEl: HTMLElement;
  scope: any;

  constructor(app: any) {
    this.app = app;
    this.contentEl = document.createElement('div');
    this.scope = {
      register: jest.fn()
    };
  }

  open(): void {
    this.onOpen();
  }

  close(): void {
    this.onClose();
  }

  onOpen(): void {
    // Mock onOpen
  }

  onClose(): void {
    // Mock onClose
  }
}
