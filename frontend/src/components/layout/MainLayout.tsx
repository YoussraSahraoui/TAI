import { NavLink, Outlet } from "react-router-dom";
import styles from "./MainLayout.module.css";
import { useTheme } from "../../hooks/useTheme";
import ThemeToggle from "../ui/ThemeToggle";

const navItems = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/entities", label: "Entities" },
  { to: "/constraints", label: "Constraints" },
  { to: "/solver", label: "Solver" },
  { to: "/", label: "← Home" },
];

export default function MainLayout() {
  const { theme, toggle } = useTheme();
  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <div className={styles.logo}>
          TAI
          <span className={styles.logoAccent} />
        </div>
        <nav>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `${styles.navLink} ${isActive ? styles.active : ""}`
              }
              end={item.to === "/dashboard" || item.to === "/"}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className={styles.sidebarFooter}>
          <ThemeToggle theme={theme} onToggle={toggle} />
        </div>
      </aside>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
