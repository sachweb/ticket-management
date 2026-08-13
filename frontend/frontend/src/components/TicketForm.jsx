import { useState } from "react";
import api from "../services/api";

const initialState = {
  title: "",
  description: "",
  category: "",
  tags: "",
  priority: "Medium"
};

const TicketForm = ({
  onCreated
}) => {
  const [form, setForm] =
    useState(initialState);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]:
        e.target.value
    });
  };

  const handleSubmit = async (
    e
  ) => {
    e.preventDefault();

    try {
      setLoading(true);
      setError("");

      const payload = {
        ...form,

        tags: form.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean)
      };

      await api.post(
        "/tickets",
        payload
      );

      setForm(initialState);

      if (onCreated) {
        onCreated();
      }
    } catch (error) {
      setError(
        // error.response?.data
        //   ?.message ||
          "Failed to create ticket"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h3>Create Ticket</h3>

      {error && (
        <p className="error">
          {error}
        </p>
      )}

      <form
        onSubmit={handleSubmit}
      >
        <input
          name="title"
          placeholder="Ticket title"
          value={form.title}
          onChange={handleChange}
          required
        />

        <textarea
          name="description"
          placeholder="Description"
          value={form.description}
          onChange={handleChange}
        />

        <input
          name="category"
          placeholder="Category e.g. Backend"
          value={form.category}
          onChange={handleChange}
          required
        />

        <input
          name="tags"
          placeholder="Tags e.g. api,payment,node"
          value={form.tags}
          onChange={handleChange}
        />

        <select
          name="priority"
          value={form.priority}
          onChange={handleChange}
        >
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

        <button
          type="submit"
          disabled={loading}
        >
          {loading
            ? "Creating..."
            : "Create Ticket"}
        </button>
      </form>
    </div>
  );
};

export default TicketForm;