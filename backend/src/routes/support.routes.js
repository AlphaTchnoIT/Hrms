import { Router } from 'express';
import {
  addTicketComment,
  closeOrReopenTicket,
  createGrievance,
  createSuggestion,
  createTicket,
  getTicket,
  listGrievances,
  listSuggestions,
  listTickets,
  respondGrievance,
  respondSuggestion,
  updateGrievance,
  updateTicket,
} from '../controllers/support.controller.js';
import { authorize } from '../middlewares/auth.middleware.js';
import { HR_ROLES, IT_ROLES } from '../constants/index.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  closeTicketSchema,
  commentSchema,
  grievanceSchema,
  respondSuggestionSchema,
  suggestionSchema,
  ticketSchema,
  updateGrievanceSchema,
  updateTicketSchema,
} from '../validators/support.validator.js';

// IT ticketing, grievances, feedback & suggestions
const router = Router();

router.get('/tickets', listTickets);
router.post('/tickets', validate(ticketSchema), createTicket);
router.get('/tickets/:id', getTicket);
router.post('/tickets/:id/comments', validate(commentSchema), addTicketComment);
router.patch('/tickets/:id/close', validate(closeTicketSchema), closeOrReopenTicket);
router.patch('/tickets/:id', authorize(IT_ROLES), validate(updateTicketSchema), updateTicket);

router.get('/grievances', listGrievances);
router.post('/grievances', validate(grievanceSchema), createGrievance);
router.post('/grievances/:id/responses', validate(commentSchema), respondGrievance);
router.patch('/grievances/:id', authorize(HR_ROLES), validate(updateGrievanceSchema), updateGrievance);

router.get('/suggestions', listSuggestions);
router.post('/suggestions', validate(suggestionSchema), createSuggestion);
router.patch('/suggestions/:id', authorize(HR_ROLES), validate(respondSuggestionSchema), respondSuggestion);

export default router;
