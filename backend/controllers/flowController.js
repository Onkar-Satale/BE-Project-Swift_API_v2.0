import Flow from '../models/flowModel.js';
import { ApiError } from '../utils/ApiError.js';

// Get all flows for authenticated user
export const getFlowsHandler = async (req, res, next) => {
  try {
    const flows = await Flow.find({ userId: req.userId }).sort({ updatedAt: -1 });
    res.json(flows || []);
  } catch (error) {
    next(error);
  }
};

// Get single flow by ID
export const getFlowByIdHandler = async (req, res, next) => {
  try {
    const { flowId } = req.params;
    const flow = await Flow.findOne({ _id: flowId, userId: req.userId });
    if (!flow) {
      return next(new ApiError(404, 'Flow not found'));
    }
    res.json(flow);
  } catch (error) {
    next(error);
  }
};

// Create a new multi-step flow
export const createFlowHandler = async (req, res, next) => {
  try {
    const { name, description, steps, initialVariables } = req.body;
    
    if (!name || !name.trim()) {
      return next(new ApiError(400, 'Flow name is required'));
    }

    const newFlow = await Flow.create({
      userId: req.userId,
      name: name.trim(),
      description: (description || '').trim(),
      steps: Array.isArray(steps) ? steps : [],
      initialVariables: initialVariables || {}
    });

    res.status(201).json(newFlow);
  } catch (error) {
    next(error);
  }
};

// Update an existing flow
export const updateFlowHandler = async (req, res, next) => {
  try {
    const { flowId } = req.params;
    const { name, description, steps, initialVariables } = req.body;

    const updated = await Flow.findOneAndUpdate(
      { _id: flowId, userId: req.userId },
      {
        $set: {
          ...(name ? { name: name.trim() } : {}),
          ...(description !== undefined ? { description: description.trim() } : {}),
          ...(steps ? { steps } : {}),
          ...(initialVariables ? { initialVariables } : {})
        }
      },
      { new: true }
    );

    if (!updated) {
      return next(new ApiError(404, 'Flow not found'));
    }

    res.json(updated);
  } catch (error) {
    next(error);
  }
};

// Delete a flow
export const deleteFlowHandler = async (req, res, next) => {
  try {
    const { flowId } = req.params;
    const deleted = await Flow.findOneAndDelete({ _id: flowId, userId: req.userId });
    if (!deleted) {
      return next(new ApiError(404, 'Flow not found'));
    }
    res.json({ success: true, message: 'Flow deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// Record flow execution results & self-healing logs
export const saveFlowRunHandler = async (req, res, next) => {
  try {
    const { flowId } = req.params;
    const { lastRun, steps } = req.body;

    const updateDoc = {
      $set: {
        lastRun: {
          ...lastRun,
          timestamp: new Date()
        }
      }
    };

    // If steps were mutated by self-healing, update them
    if (Array.isArray(steps) && steps.length > 0) {
      updateDoc.$set.steps = steps;
    }

    const flow = await Flow.findOneAndUpdate(
      { _id: flowId, userId: req.userId },
      updateDoc,
      { new: true }
    );

    if (!flow) {
      return next(new ApiError(404, 'Flow not found'));
    }

    res.json({ success: true, flow });
  } catch (error) {
    next(error);
  }
};
