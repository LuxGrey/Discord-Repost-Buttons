/**
 * Sends a repost request to a repost server
 * 
 * @param {string} requestUrl URL to which the repost request should be made
 * @param {object} body request body; will be turned into JSON string
 * @param {string} authToken optional auth token which will be included as a bearer token in
 *                           the Authorization request header
 * @returns {Promise<Response>} the response from the repost server
 */
export function sendServerRequest(requestUrl, body, authToken = undefined) {
    const headers = {
        'Content-Type': 'application/json',
    };

    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }

    return fetch(requestUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
    });
}