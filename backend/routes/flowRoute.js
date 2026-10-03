import express from 'express';
import {
  getFlowsHandler,
  getFlowByIdHandler,
  createFlowHandler,
  updateFlowHandler,
  deleteFlowHandler,
  saveFlowRunHandler
} from '../controllers/flowController.js';
import auth from '../middlewares/authMiddleware.js';

const router = express.Router();

// All flow routes are protected with auth middleware
router.use(auth);

router.get('/', getFlowsHandler);
router.post('/', createFlowHandler);
router.get('/:flowId', getFlowByIdHandler);
router.put('/:flowId', updateFlowHandler);
router.delete('/:flowId', deleteFlowHandler);
router.post('/:flowId/run-results', saveFlowRunHandler);

export default router;
