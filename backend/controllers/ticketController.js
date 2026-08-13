const mongoose = require("mongoose");

const Ticket = require("../models/Ticket");
const User = require("../models/User");
const IdempotencyKey = require("../models/IdempotencyKey");

const {
  getRecommendedTickets
} = require("../services/recommendationService");

/*
  CREATE TICKET
*/

const createTicket = async (req, res, next) => {
  try {
    const {
      title,
      description,
      category,
      tags,
      priority,
      dependencies
    } = req.body;

    if (!title || !category) {
      return res.status(400).json({
        success: false,
        message: "Title and category are required"
      });
    }

    const ticket = await Ticket.create({
      title,
      description,
      category,
      tags: tags || [],
      priority: priority || "Medium",
      dependencies: dependencies || [],
      createdBy: req.user.id
    });

    const populatedTicket =
      await Ticket.findById(ticket._id)
        .populate("createdBy", "name email")
        .populate("assignedTo", "name email");

    req.app
      .get("io")
      .emit(
        "ticketCreated",
        populatedTicket
      );

    return res.status(201).json({
      success: true,
      message: "Ticket created successfully",
      data: populatedTicket
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/*
  GET TICKETS
  Search + Filter + Pagination
*/

const getTickets = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      status = "",
      priority = "",
      category = ""
    } = req.query;

    const pageNumber =
      Math.max(Number(page), 1);

    const limitNumber =
      Math.min(
        Math.max(Number(limit), 1),
        100
      );

    const skip =
      (pageNumber - 1) *
      limitNumber;

    const query = {};

    if (search) {
      query.$or = [
        {
          title: {
            $regex: search,
            $options: "i"
          }
        },
        {
          description: {
            $regex: search,
            $options: "i"
          }
        }
      ];
    }

    if (status) {
      query.status = status;
    }

    if (priority) {
      query.priority = priority;
    }

    if (category) {
      query.category = category;
    }

    const [tickets, total] =
      await Promise.all([
        Ticket.find(query)
          .populate(
            "createdBy",
            "name email"
          )
          .populate(
            "assignedTo",
            "name email"
          )
          .sort({
            createdAt: -1
          })
          .skip(skip)
          .limit(limitNumber),

        Ticket.countDocuments(query)
      ]);

    return res.json({
      success: true,
      data: tickets,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total,
        totalPages: Math.ceil(
          total / limitNumber
        )
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/*
  GET SINGLE TICKET
*/

const getTicket = async (req, res) => {
  try {
    const ticket =
      await Ticket.findById(req.params.id)
        .populate(
          "createdBy",
          "name email"
        )
        .populate(
          "assignedTo",
          "name email"
        );

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found"
      });
    }

    return res.json({
      success: true,
      data: ticket
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/*
  UPDATE TICKET

  Uses version for optimistic concurrency.
*/

const updateTicket = async (req, res) => {
  try {
    const ticketId = req.params.id;

    const {
      title,
      description,
      category,
      tags,
      priority,
      status,
      version
    } = req.body;

    if (version === undefined) {
      return res.status(400).json({
        success: false,
        message:
          "Version is required for update"
      });
    }

    const updateData = {};

    if (title !== undefined)
      updateData.title = title;

    if (description !== undefined)
      updateData.description =
        description;

    if (category !== undefined)
      updateData.category = category;

    if (tags !== undefined)
      updateData.tags = tags;

    if (priority !== undefined)
      updateData.priority = priority;

    if (status !== undefined)
      updateData.status = status;

    const updatedTicket =
      await Ticket.findOneAndUpdate(
        {
          _id: ticketId,
          version: Number(version)
        },
        {
          $set: updateData,
          $inc: {
            version: 1
          }
        },
        {
          new: true,
          runValidators: true
        }
      )
        .populate(
          "createdBy",
          "name email"
        )
        .populate(
          "assignedTo",
          "name email"
        );

    if (!updatedTicket) {
      return res.status(409).json({
        success: false,
        message:
          "Ticket was modified by another user. Please refresh and try again."
      });
    }

    req.app
      .get("io")
      .emit(
        "ticketUpdated",
        updatedTicket
      );

    return res.json({
      success: true,
      message: "Ticket updated successfully",
      data: updatedTicket
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/*
  ASSIGN TICKET

  Atomic update prevents two agents
  from assigning the same ticket.
*/

const assignTicket = async (req, res) => {
  try {
    const ticketId = req.params.id;

    const {
      assignedTo
    } = req.body;

    if (!assignedTo) {
      return res.status(400).json({
        success: false,
        message:
          "assignedTo is required"
      });
    }

    if (
      !mongoose.Types.ObjectId.isValid(
        assignedTo
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID"
      });
    }

    const user =
      await User.findById(
        assignedTo
      );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Agent not found"
      });
    }

    /*
      Atomic condition:
      only assign when currently
      Pending + unassigned.
    */

    const ticket =
      await Ticket.findOneAndUpdate(
        {
          _id: ticketId,
          status: "Pending",
          assignedTo: null
        },
        {
          $set: {
            assignedTo
              ,
            status: "In Progress"
          },
          $inc: {
            version: 1
          }
        },
        {
          new: true
        }
      )
        .populate(
          "createdBy",
          "name email"
        )
        .populate(
          "assignedTo",
          "name email"
        );

    if (!ticket) {
      return res.status(409).json({
        success: false,
        message:
          "Ticket is already assigned or unavailable"
      });
    }

    req.app
      .get("io")
      .emit(
        "ticketAssigned",
        ticket
      );

    return res.json({
      success: true,
      message: "Ticket assigned successfully",
      data: ticket
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/*
  RESOLVE TICKET

  Idempotent using Idempotency-Key
*/

const resolveTicket = async (req, res) => {
  try {
    const ticketId = req.params.id;

    const idempotencyKey =
      req.headers["idempotency-key"];

    if (!idempotencyKey) {
      return res.status(400).json({
        success: false,
        message:
          "Idempotency-Key header is required"
      });
    }

    /*
      Try creating idempotency record.
      Unique index ensures only one request
      can claim the same key.
    */

    let operation;

    try {
      operation =
        await IdempotencyKey.create({
          key: idempotencyKey,
          userId: req.user.id,
          status: "PROCESSING"
        });
    } catch (error) {
      /*
        Duplicate key means request
        was already processed/processing.
      */

      if (
        error.code === 11000
      ) {
        operation =
          await IdempotencyKey.findOne({
            key: idempotencyKey
          });

        if (
          operation &&
          operation.status ===
            "COMPLETED"
        ) {
          return res.json(
            operation.response
          );
        }

        return res.status(409).json({
          success: false,
          message:
            "Request is already being processed"
        });
      }

      throw error;
    }

    /*
      Resolve ticket atomically.
    */

    const ticket =
      await Ticket.findOneAndUpdate(
        {
          _id: ticketId,
          status: {
            $ne: "Resolved"
          }
        },
        {
          $set: {
            status: "Resolved"
          },
          $inc: {
            version: 1
          }
        },
        {
          new: true
        }
      );

    if (!ticket) {
      const response = {
        success: false,
        message:
          "Ticket not found or already resolved"
      };

      await IdempotencyKey.findByIdAndUpdate(
        operation._id,
        {
          status: "COMPLETED",
          response
        }
      );

      return res.status(404).json(
        response
      );
    }

    /*
      Find next recommendations.
    */

    const recommendations =
      await getRecommendedTickets(
        ticket,
        5
      );

    const response = {
      success: true,
      message:
        "Ticket resolved successfully",
      data: ticket,
      recommendations
    };

    /*
      Save idempotent response.
    */

    await IdempotencyKey.findByIdAndUpdate(
      operation._id,
      {
        status: "COMPLETED",
        response
      }
    );

    /*
      Real-time event.
    */

    req.app
      .get("io")
      .emit(
        "ticketResolved",
        {
          ticket,
          recommendations
        }
      );

    return res.json(response);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/*
  DELETE TICKET
*/

const deleteTicket = async (
  req,
  res
) => {
  try {
    const ticket =
      await Ticket.findByIdAndDelete(
        req.params.id
      );

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found"
      });
    }

    req.app
      .get("io")
      .emit(
        "ticketDeleted",
        {
          id: ticket._id
        }
      );

    return res.json({
      success: true,
      message: "Ticket deleted successfully"
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/*
  GET RECOMMENDATIONS
*/

const getRecommendations = async (
  req,
  res
) => {
  try {
    const ticket =
      await Ticket.findById(
        req.params.id
      );

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found"
      });
    }

    const recommendations =
      await getRecommendedTickets(
        ticket,
        5
      );

    return res.json({
      success: true,
      data: recommendations
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  createTicket,
  getTickets,
  getTicket,
  updateTicket, 
  assignTicket,
  resolveTicket,
  deleteTicket,
  getRecommendations
};