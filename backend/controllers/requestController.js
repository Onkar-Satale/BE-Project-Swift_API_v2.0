import requestService from '../services/requestService.js';

/**
 * Handles proxy API execution requests, executing the target HTTP request
 * and storing the result in the user's history log.
 */
export const proxyRequestHandler = async (req, res, next) => {
  try {
    const { url, method, headers, params, body } = req.body;
    
    const result = await requestService.executeAndSaveRequest(req.userId, { url, method, headers, params, body });

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};
