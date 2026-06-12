declare module "@earendil-works/pi-coding-agent" {
  export interface ExtensionAPI {
    registerTool(definition: unknown): void;
  }
}

declare module "@earendil-works/pi-tui" {
  export class Text {
    constructor(text: string, x: number, y: number);
  }
}

declare module "typebox" {
  export const Type: {
    Object(schema: Record<string, unknown>, options?: Record<string, unknown>): unknown;
    String(options?: Record<string, unknown>): unknown;
    Array(schema: unknown, options?: Record<string, unknown>): unknown;
    Number(options?: Record<string, unknown>): unknown;
    Boolean(options?: Record<string, unknown>): unknown;
    Optional(schema: unknown): unknown;
  };
}
