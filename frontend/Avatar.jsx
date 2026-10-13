import heron from "./assets/maki-heron.png";

export default function Avatar({ user = false, className = "" }) {
  return (
    <span className={`avatar ${user ? "avatar-user" : "avatar-maki"} ${className}`} aria-hidden="true">
      {user ? (
        <svg viewBox="0 0 32 32" fill="none">
          <circle cx="16" cy="11" r="5" fill="currentColor" />
          <path d="M6 27c0-6 4-10 10-10s10 4 10 10" fill="currentColor" />
        </svg>
      ) : <img src={heron} alt="" width="48" height="48" />}
    </span>
  );
}