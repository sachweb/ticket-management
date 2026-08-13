const Ticket = require("../models/Ticket");

const PRIORITY_SCORE = {
  Low: 10,
  Medium: 20,
  High: 30,
  Critical: 40
};

const calculateScore = (
  currentTicket,
  candidate
) => {
  let score = 0;

  // Priority similarity
  if (
    currentTicket.priority ===
    candidate.priority
  ) {
    score += 40;
  }

  // Category similarity
  if (
    currentTicket.category ===
    candidate.category
  ) {
    score += 30;
  }

  // Tag similarity
  const currentTags =
    currentTicket.tags || [];

  const candidateTags =
    candidate.tags || [];

  const matchingTags =
    candidateTags.filter((tag) =>
      currentTags.includes(tag)
    );

  score += matchingTags.length * 10;

  // Dependency relationship
  const currentId =
    currentTicket._id.toString();

  const hasDependency =
    candidate.dependencies?.some(
      (id) =>
        id.toString() === currentId
    );

  if (hasDependency) {
    score += 20;
  }

  // Additional priority weight
  score +=
    PRIORITY_SCORE[candidate.priority] || 0;

  return score;
};

const getRecommendedTickets = async (
  currentTicket,
  limit = 5
) => {
  const candidates =
    await Ticket.find({
      status: "Pending",
      _id: {
        $ne: currentTicket._id
      }
    }).limit(100);

  const recommendations =
    candidates
      .map((ticket) => ({
        ticket,
        score: calculateScore(
          currentTicket,
          ticket
        )
      }))
      .sort((a, b) =>
        b.score - a.score
      )
      .slice(0, limit);

  return recommendations;
};

module.exports = {
  getRecommendedTickets
};