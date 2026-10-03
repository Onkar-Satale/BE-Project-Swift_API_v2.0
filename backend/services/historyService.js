import mongoose from 'mongoose';
import User from '../models/userModel.js';

// Helper to sanitize and bound large payloads before storing in MongoDB subdocuments
function sanitizePayload(data, maxBytes = 32768) {
  if (data === null || data === undefined) return null;
  try {
    if (typeof data === 'string') {
      if (data.length > maxBytes) {
        return data.slice(0, maxBytes) + '... [Truncated for storage optimization]';
      }
      return data;
    }
    const str = JSON.stringify(data);
    if (str.length > maxBytes) {
      if (Array.isArray(data)) {
        return data.slice(0, 20).map(item => {
          if (typeof item === 'object' && item !== null) {
            const preview = {};
            for (const [k, v] of Object.entries(item)) {
              if (k === 'url' || k === 'name' || k === 'method' || k === 'status' || k === '_id' || k === 'time') {
                preview[k] = v;
              } else if (typeof v === 'string') {
                preview[k] = v.length > 80 ? v.slice(0, 80) + '…' : v;
              } else if (typeof v === 'number' || typeof v === 'boolean') {
                preview[k] = v;
              }
            }
            return preview;
          }
          return item;
        });
      }
      return { _truncated: true, size: str.length, summary: `Payload (${str.length} bytes) was truncated to preserve storage limits.` };
    }
    return data;
  } catch {
    return null;
  }
}

// Service managing user API request history records and RAG resolution memories.
class HistoryService {
  // Fetches the 50 most recent request history entries for a user in reverse chronological order.
  async getHistory(userId) {
    try {
      if (!mongoose.Types.ObjectId.isValid(userId)) return [];
      const user = await User.findById(userId, { history: { $slice: -50 } });
      if (!user) return [];

      return Array.isArray(user.history) ? user.history.slice().reverse() : [];
    } catch (err) {
      console.warn('[HistoryService] getHistory fetch error:', err.message);
      try {
        await User.findByIdAndUpdate(userId, {
          $push: { history: { $each: [], $slice: -25 } }
        });
        const user = await User.findById(userId, { history: { $slice: -25 } });
        return user?.history ? user.history.slice().reverse() : [];
      } catch {
        return [];
      }
    }
  }

  // Appends a new API request history entry to the user's history array, capping total items at 50 with payload safety.
  async pushHistoryItem(userId, historyEntry) {
    const newEntry = {
      ...historyEntry,
      requestBody: sanitizePayload(historyEntry.requestBody, 16384),
      responseBody: sanitizePayload(historyEntry.responseBody, 32768),
      _id: new mongoose.Types.ObjectId(),
      time: historyEntry.time || new Date()
    };

    try {
      await User.findByIdAndUpdate(userId, {
        $push: {
          history: {
            $each: [newEntry],
            $slice: -50 // Cap history array at latest 50 items
          }
        },
        $inc: { reqCount: 1 }
      });
    } catch (err) {
      // Auto-heal on MongoDB BSON document size overflow (>16MB)
      if (err.message && (err.message.includes('BSONObj size') || err.message.includes('16777216') || err.message.includes('document size'))) {
        console.warn(`[HistoryService] Document size limit reached for user ${userId}. Pruning oversized history array...`);
        try {
          const user = await User.findById(userId);
          if (user && Array.isArray(user.history)) {
            const pruned = user.history.slice(-15).map(h => {
              const obj = h.toObject ? h.toObject() : { ...h };
              return {
                ...obj,
                responseBody: sanitizePayload(obj.responseBody, 4096),
                requestBody: sanitizePayload(obj.requestBody, 2048)
              };
            });
            await User.findByIdAndUpdate(userId, {
              $set: { history: [...pruned, newEntry] }
            });
          } else {
            await User.findByIdAndUpdate(userId, {
              $set: { history: [newEntry] }
            });
          }
        } catch (repairErr) {
          console.error('[HistoryService] Emergency history reset required:', repairErr.message);
          await User.findByIdAndUpdate(userId, { $set: { history: [newEntry] } });
        }
      } else {
        throw err;
      }
    }

    return newEntry;
  }

  // Appends a new verified resolution episode into the user's RAG memory
  async pushResolutionEpisode(userId, episode) {
    const newEpisode = {
      ...episode,
      _id: new mongoose.Types.ObjectId(),
      timestamp: episode.timestamp || new Date()
    };

    await User.findByIdAndUpdate(userId, {
      $push: {
        resolutionEpisodes: {
          $each: [newEpisode],
          $slice: -100
        }
      }
    });

    return newEpisode;
  }

  // Retrieves stored resolution episodes for RAG initialization
  async getResolutionEpisodes(userId) {
    const user = await User.findById(userId, { resolutionEpisodes: { $slice: -50 } });
    if (!user) return [];
    return user.resolutionEpisodes || [];
  }

  // Deletes a specific history item by ID from the user document.
  async deleteHistoryItem(userId, historyId) {
    return await User.findByIdAndUpdate(userId, {
      $pull: { history: { _id: historyId } },
    });
  }

  // Clears all history entries for a user document.
  async clearHistory(userId) {
    return await User.findByIdAndUpdate(userId, { $set: { history: [] } });
  }
}

export default new HistoryService();
