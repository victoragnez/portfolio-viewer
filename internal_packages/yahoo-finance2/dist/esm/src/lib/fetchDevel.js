/* istanbul ignore file */
import nodeFetch from "node-fetch";

async function fetchDevel(url, fetchOptions) {
  return await nodeFetch(url, fetchOptions);
}
export default fetchDevel;
