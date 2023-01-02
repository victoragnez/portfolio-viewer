/// <reference types="node" />
import fetch from "node-fetch";
import { URLSearchParams } from "url";
declare function fetchDevel(): Promise<Function>;
declare const _default: {
  fetch: typeof fetch;
  fetchDevel: typeof fetchDevel;
  URLSearchParams: typeof URLSearchParams;
};
export default _default;
