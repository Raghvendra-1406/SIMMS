import { unsubscribeOnLogout } from "./push";

export function navigateTo(path) {
  window.location.href = path;
}

export function logout() {
  ["access_token", "user_id", "name", "email", "role", "is_active"].forEach(
    (key) => localStorage.removeItem(key)
  );

  // Stop this device's push alerts for the user who is leaving.
  unsubscribeOnLogout().finally(() => {
    window.location.href = "/";
  });
}
