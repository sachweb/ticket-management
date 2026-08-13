const express = require("express");

const authMiddleware = require("../middleware/authMiddleware");

const {
  createTicket,
  getTickets,
  getTicket,
  updateTicket,
  assignTicket,
  resolveTicket,
  deleteTicket,
  getRecommendations
} = require("../controllers/ticketController");

const router = express.Router();

router.use(authMiddleware);

router.post("/", createTicket);

router.get("/", getTickets);

router.get(
  "/:id",
  getTicket
);

router.put(
  "/:id",
  updateTicket
);

router.patch(
  "/:id/assign",
  assignTicket
);

router.patch(
  "/:id/resolve",
  resolveTicket
);

router.get(
  "/:id/recommendations",
  getRecommendations
);

router.delete(
  "/:id",
  deleteTicket
);

module.exports = router;