export function navigateTo(path) {
  window.location.href = path;
}

export function logout() {
  ["access_token", "user_id", "name", "email", "role", "is_active"].forEach(
    (key) => localStorage.removeItem(key)
  );
  window.location.href = "/";
}
