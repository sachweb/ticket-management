import { useNavigate } from "react-router-dom";

const Navbar = () => {
  const navigate =
    useNavigate();

  const user = JSON.parse(
    localStorage.getItem("user") || "{}"
  );

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    navigate("/login");
  };

  return (
    <nav className="navbar">
      <h2>Ticket Management</h2>

      <div className="nav-right">
        <span>
          {user.name || "User"}
        </span>

        <button
          onClick={logout}
        >
          Logout
        </button>
      </div>
    </nav>
  );
};

export default Navbar;