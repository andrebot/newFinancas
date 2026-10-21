// How every Experience's endpoints describe a request to RTK Query's base
// query: the path, the method and, when there is one, the JSON body. Shared
// so a change to how requests are built lands in one place.

/**
 * Builds a request with a method and an optional JSON body.
 *
 * @param method - The HTTP method.
 * @param url - The path, relative to the API's base URL.
 * @param body - The JSON body, if any.
 * @returns The request's fetch arguments.
 */
const send = (method: string, url: string, body?: object) => ({ url, method, body });

export default send;
