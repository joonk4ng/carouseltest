declare module 'xlsx-populate' {
  export interface Workbook {
    sheet(index: number): Sheet;
    outputAsync(options?: { type: 'base64' | 'binary' | 'nodebuffer' | 'array' | 'uint8array' }): Promise<Uint8Array>;
  }

  export interface Sheet {
    cell(address: string): Cell;
    usedRange(): Range;
    protect(options: ProtectionOptions): void;
  }

  export interface Cell {
    value(value: any): Cell;
    style(property: string, value: any): Cell;
  }

  export interface Range {
    style(property: string, value: any): Range;
  }

  export interface ProtectionOptions {
    selectLockedCells: boolean;
    selectUnlockedCells: boolean;
    formatCells: boolean;
    formatColumns: boolean;
    formatRows: boolean;
    insertColumns: boolean;
    insertRows: boolean;
    insertHyperlinks: boolean;
    deleteColumns: boolean;
    deleteRows: boolean;
    sort: boolean;
    autoFilter: boolean;
    pivotTables: boolean;
    objects: boolean;
    scenarios: boolean;
  }

  export function fromFileAsync(path: string): Promise<Workbook>;
  export function fromDataAsync(data: Uint8Array): Promise<Workbook>;
} 