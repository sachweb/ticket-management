import {
  useEffect,
  useState
} from "react";

import Navbar from "../components/Navbar";
import TicketForm from "../components/TicketForm";

import api from "../services/api";
import socket from "../services/socket";

const Dashboard = () => {
  const [tickets, setTickets] =
    useState([]);

  const [recommendations, setRecommendations] =
    useState([]);

  const [search, setSearch] =
    useState("");

  const [status, setStatus] =
    useState("");

  const [priority, setPriority] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [page, setPage] =
    useState(1);

  const [pagination, setPagination] =
    useState({
      page: 1,
      totalPages: 1,
      total: 0
    });

  const [error, setError] =
    useState("");

  /*
    Fetch tickets
  */

  const fetchTickets = async () => {
    try {
      setLoading(true);
      setError("");

      const response =
        await api.get(
          "/tickets",
          {
            params: {
              page,
              limit: 10,
              search,
              status,
              priority
            }
          }
        );

      setTickets(
        response.data.data
      );

      setPagination(
        response.data.pagination
      );
    } catch (error) {
      setError(
        error.response?.data
          ?.message ||
          "Failed to fetch tickets"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [
    page,
    search,
    status,
    priority
  ]);

  /*
    Socket events
  */

  useEffect(() => {
    const handleCreated = () => {
      fetchTickets();
    };

    const handleUpdated = (
      updatedTicket
    ) => {
      setTickets((prev) =>
        prev.map((ticket) =>
          ticket._id ===
          updatedTicket._id
            ? updatedTicket
            : ticket
        )
      );
    };

    const handleAssigned = (
      updatedTicket
    ) => {
      setTickets((prev) =>
        prev.map((ticket) =>
          ticket._id ===
          updatedTicket._id
            ? updatedTicket
            : ticket
        )
      );
    };

    const handleDeleted = ({
      id
    }) => {
      setTickets((prev) =>
        prev.filter(
          (ticket) =>
            ticket._id !== id
        )
      );
    };

    const handleResolved = ({
      ticket,
      recommendations
    }) => {
      setTickets((prev) =>
        prev.map((item) =>
          item._id === ticket._id
            ? ticket
            : item
        )
      );

      setRecommendations(
        recommendations
      );
    };

    socket.on(
      "ticketCreated",
      handleCreated
    );

    socket.on(
      "ticketUpdated",
      handleUpdated
    );

    socket.on(
      "ticketAssigned",
      handleAssigned
    );

    socket.on(
      "ticketDeleted",
      handleDeleted
    );

    socket.on(
      "ticketResolved",
      handleResolved
    );

    return () => {
      socket.off(
        "ticketCreated",
        handleCreated
      );

      socket.off(
        "ticketUpdated",
        handleUpdated
      );

      socket.off(
        "ticketAssigned",
        handleAssigned
      );

      socket.off(
        "ticketDeleted",
        handleDeleted
      );

      socket.off(
        "ticketResolved",
        handleResolved
      );
    };
  }, []);

  /*
    Assign ticket to current user
  */

  const assignTicket = async (
    ticketId
  ) => {
    try {
      const user =
        JSON.parse(
          localStorage.getItem(
            "user"
          )
        );

      const response =
        await api.patch(
          `/tickets/${ticketId}/assign`,
          {
            assignedTo: user.id
          }
        );

      setTickets((prev) =>
        prev.map((ticket) =>
          ticket._id === ticketId
            ? response.data.data
            : ticket
        )
      );
    } catch (error) {
      alert(
        error.response?.data
          ?.message ||
          "Assignment failed"
      );
    }
  };

  /*
    Resolve ticket
  */

  const resolveTicket = async (
    ticket
  ) => {
    try {
      const idempotencyKey =
        `${ticket._id}-${Date.now()}-${Math.random()}`;

      const response =
        await api.patch(
          `/tickets/${ticket._id}/resolve`,
          {},
          {
            headers: {
              "Idempotency-Key":
                idempotencyKey
            }
          }
        );

      setTickets((prev) =>
        prev.map((item) =>
          item._id === ticket._id
            ? response.data.data
            : item
        )
      );

      setRecommendations(
        response.data
          .recommendations
      );
    } catch (error) {
      alert(
        error.response?.data
          ?.message ||
          "Resolve failed"
      );
    }
  };

  /*
    Delete ticket
  */

  const deleteTicket = async (
    id
  ) => {
    const confirmed =
      window.confirm(
        "Delete this ticket?"
      );

    if (!confirmed) return;

    try {
      await api.delete(
        `/tickets/${id}`
      );

      setTickets((prev) =>
        prev.filter(
          (ticket) =>
            ticket._id !== id
        )
      );
    } catch (error) {
      alert(
        error.response?.data
          ?.message ||
          "Delete failed"
      );
    }
  };

  return (
    <>
      <Navbar />

      <main className="dashboard">

        <section className="dashboard-header">
          <div>
            <h1>
              Ticket Dashboard
            </h1>

            <p>
              Manage and monitor tickets
              in real time.
            </p>
          </div>
        </section>

        <TicketForm
          onCreated={
            fetchTickets
          }
        />

        {error && (
          <div className="error-box">
            {error}
          </div>
        )}

        {/* Filters */}

        <section className="filters card">

          <input
            placeholder="Search tickets..."
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(
                e.target.value
              );
            }}
          />

          <select
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(
                e.target.value
              );
            }}
          >
            <option value="">
              All Status
            </option>

            <option value="Pending">
              Pending
            </option>

            <option value="In Progress">
              In Progress
            </option>

            <option value="Resolved">
              Resolved
            </option>
          </select>

          <select
            value={priority}
            onChange={(e) => {
              setPage(1);
              setPriority(
                e.target.value
              );
            }}
          >
            <option value="">
              All Priority
            </option>

            <option value="Low">
              Low
            </option>

            <option value="Medium">
              Medium
            </option>

            <option value="High">
              High
            </option>

            <option value="Critical">
              Critical
            </option>
          </select>

        </section>

        <div className="dashboard-grid">

          {/* Ticket List */}

          <section>
            <div className="card">

              <div className="section-title">
                <h2>
                  Tickets
                </h2>

                <span>
                  Total:{" "}
                  {pagination.total}
                </span>
              </div>

              {loading ? (
                <p>
                  Loading...
                </p>
              ) : tickets.length ===
                0 ? (
                <p>
                  No tickets found.
                </p>
              ) : (
                tickets.map(
                  (ticket) => (
                    <div
                      className="ticket"
                      key={
                        ticket._id
                      }
                    >
                      <div className="ticket-main">

                        <h3>
                          {ticket.title}
                        </h3>

                        <p>
                          {
                            ticket.description
                          }
                        </p>

                        <div className="meta">

                          <span>
                            Category:{" "}
                            {
                              ticket.category
                            }
                          </span>

                          <span>
                            Priority:{" "}
                            {
                              ticket.priority
                            }
                          </span>

                          <span>
                            Status:{" "}
                            {
                              ticket.status
                            }
                          </span>

                        </div>

                        <div className="tags">
                          {ticket.tags?.map(
                            (tag) => (
                              <span
                                key={tag}
                              >
                                #
                                {tag}
                              </span>
                            )
                          )}
                        </div>

                      </div>

                      <div className="ticket-actions">

                        {ticket.status ===
                          "Pending" && (
                          <button
                            onClick={() =>
                              assignTicket(
                                ticket._id
                              )
                            }
                          >
                            Assign to Me
                          </button>
                        )}

                        {ticket.status ===
                          "In Progress" && (
                          <button
                            onClick={() =>
                              resolveTicket(
                                ticket
                              )
                            }
                          >
                            Resolve
                          </button>
                        )}

                        <button
                          className="danger"
                          onClick={() =>
                            deleteTicket(
                              ticket._id
                            )
                          }
                        >
                          Delete
                        </button>

                      </div>
                    </div>
                  )
                )
              )}

              {/* Pagination */}

              <div className="pagination">

                <button
                  disabled={
                    page <= 1
                  }
                  onClick={() =>
                    setPage(
                      (prev) =>
                        prev - 1
                    )
                  }
                >
                  Previous
                </button>

                <span>
                  Page {page} of{" "}
                  {
                    pagination.totalPages
                  }
                </span>

                <button
                  disabled={
                    page >=
                    pagination.totalPages
                  }
                  onClick={() =>
                    setPage(
                      (prev) =>
                        prev + 1
                    )
                  }
                >
                  Next
                </button>

              </div>

            </div>
          </section>

          {/* Recommendations */}

          <aside>

            <div className="card recommendation">

              <h2>
                Recommended Next Tickets
              </h2>

              {recommendations.length ===
              0 ? (
                <p>
                  Resolve a ticket to
                  get recommendations.
                </p>
              ) : (
                recommendations.map(
                  (item) => (
                    <div
                      className="recommendation-item"
                      key={
                        item.ticket._id
                      }
                    >
                      <h3>
                        {
                          item.ticket
                            .title
                        }
                      </h3>

                      <p>
                        Score:{" "}
                        <strong>
                          {item.score}
                        </strong>
                      </p>

                      <p>
                        {
                          item.ticket
                            .category
                        }{" "}
                        •{" "}
                        {
                          item.ticket
                            .priority
                        }
                      </p>
                    </div>
                  )
                )
              )}

            </div>

          </aside>

        </div>

      </main>
    </>
  );
};

export default Dashboard;