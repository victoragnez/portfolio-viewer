import type { QueueOptions } from "./queue.js";
import type { ValidationOptions } from "./validateAndCoerceTypes.js";
export interface YahooFinanceOptions {
  YF_QUERY_HOST?: string;
  queue?: QueueOptions;
  validation?: ValidationOptions;
}
declare const options: YahooFinanceOptions;
export default options;
