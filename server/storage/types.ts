export interface JsonDataStore<T> {
  read(): Promise<T>;
  write(data: T): Promise<void>;
}
