declare module "node:sqlite" {
  export type SQLInputValue = null | number | bigint | string | Uint8Array;
  export type SQLOutputValue = null | number | bigint | string | Uint8Array;
  export interface StatementResultingChanges {
    changes: number | bigint;
    lastInsertRowid: number | bigint;
  }
  export class StatementSync {
    all(...params: SQLInputValue[]): Record<string, SQLOutputValue>[];
    get(...params: SQLInputValue[]): Record<string, SQLOutputValue> | undefined;
    run(...params: SQLInputValue[]): StatementResultingChanges;
    setReturnArrays(allowReturnArrays: boolean): void;
  }
  export class DatabaseSync {
    constructor(
      location: string,
      options?: { open?: boolean; readOnly?: boolean },
    );
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    close(): void;
  }
}
