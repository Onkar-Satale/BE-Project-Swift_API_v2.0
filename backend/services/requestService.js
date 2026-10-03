import axios from 'axios';
import { ApiError } from '../utils/ApiError.js';
import historyService from './historyService.js';

// Service providing proxy HTTP request execution and user history tracking.
class RequestService {
  /**
   * Helper to compute timeline grouping key (e.g. "GET:https://api.example.com/users")
   */
  getTimelineKey(method, url) {
    try {
      const u = new URL(url);
      return `${method.toUpperCase()}:${u.origin}${u.pathname}`;
    } catch {
      const base = (url || '').split('?')[0];
      return `${method.toUpperCase()}:${base}`;
    }
  }

  /**
   * Executes an outgoing HTTP request on behalf of the client.
   * Prevents SSRF attacks targeting file protocol while allowing testing of local APIs.
   */
  async executeProxyRequest({ url, method, headers, params, body }) {
    // Only prevent dangerous file system protocols
    if (url.startsWith('file://')) {
      throw new ApiError(403, 'Access to local file protocol is forbidden.');
    }

    const axiosConfig = {
      url,
      method: method.toUpperCase(),
      headers: headers && typeof headers === 'object' ? headers : {},
      validateStatus: () => true, // Treat all HTTP response status codes as successful resolves
    };

    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(axiosConfig.method)) {
      axiosConfig.data = body || {};
    }

    if (axiosConfig.method === 'GET' && params && typeof params === 'object') {
      axiosConfig.params = params;
    }

    const start = Date.now();
    let apiResponse;
    try {
      apiResponse = await axios(axiosConfig);
    } catch (err) {
      apiResponse = err.response || { status: 'ERR', data: { error: err.message }, headers: {} };
    }
    const duration = Date.now() - start;

    return {
      status: apiResponse.status || 'ERR',
      headers: apiResponse.headers || {},
      body: apiResponse.data || {},
      duration
    };
  }

  // Executes a proxy HTTP request and saves the result into the user's history log.
  async executeAndSaveRequest(userId, { url, method, headers, params, body, appliedFix, aiDiagnosis }) {
    const proxyResult = await this.executeProxyRequest({ url, method, headers, params, body });

    const timelineKey = this.getTimelineKey(method, url);

    const historyEntry = {
      method,
      url,
      headers: headers || {},
      params: params || {},
      requestBody: body || null,
      responseBody: proxyResult.body,
      status: proxyResult.status,
      duration: proxyResult.duration,
      appliedFix: appliedFix || null,
      aiDiagnosis: aiDiagnosis || null,
      timelineKey,
      time: new Date()
    };

    const savedEntry = await historyService.pushHistoryItem(userId, historyEntry);

    // Asynchronously generate and store single embedding in ChromaDB for this specific request
    const genaiUrl = process.env.GENAI_SERVICE_URL;
    const genaiSecret = process.env.GENAI_API_SECRET;
    if (genaiUrl) {
      axios.post(`${genaiUrl}/rag/index-episode`, {
        userId: String(userId || "guest"),
        method: method.toUpperCase(),
        url,
        failedStatus: proxyResult.status,
        errorSnippet: typeof proxyResult.body === "object" ? JSON.stringify(proxyResult.body).slice(0, 300) : String(proxyResult.body || "").slice(0, 300),
        rootCauseLayer: String(proxyResult.status).startsWith("2") ? "Success" : "General",
        appliedFix: appliedFix || {},
        successStatus: String(proxyResult.status).startsWith("2") ? proxyResult.status : 200,
        successDuration: proxyResult.duration,
        customId: `req_${savedEntry._id || Date.now()}`
      }, {
        headers: { 'x-api-key': genaiSecret },
        timeout: 3000
      }).catch(() => {});
    }
    
    return {
      ...proxyResult,
      historyId: savedEntry._id,
      timelineKey,
    };
  }
}

export default new RequestService();
