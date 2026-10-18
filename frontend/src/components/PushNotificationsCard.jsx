import { useEffect, useState } from "react";
import Icon from "./Icon";
import { Alert, Card, Spinner, StatusBadge } from "./ui";
import { disablePush, enablePush, getPushState, sendTestPush } from "../lib/push";

/**
 * "Phone notifications" card: turn Web Push on or off for this device
 * and send a test (Plan v2 C8, T16).
 */
export default function PushNotificationsCard() {
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState(null);

  useEffect(() => {
    getPushState().then(setState);
  }, []);

  const run = async (key, action, success) => {
    setBusy(key);
    setMessage(null);

    try {
      await action();
      if (success) setMessage({ tone: "success", text: success });
    } catch (err) {
      setMessage({ tone: "danger", text: err.message });
    } finally {
      setState(await getPushState());
      setBusy("");
    }
  };

  let status;
  let hint = "";

  if (!state) {
    status = <Spinner />;
  } else if (!state.supported) {
    status = <StatusBadge tone="neutral" label="Not supported" />;
    hint = "This browser can't receive push notifications. On iPhone, add SIMMS to the Home Screen first (iOS 16.4+).";
  } else if (!state.secure) {
    status = <StatusBadge tone="neutral" label="Needs https" />;
    hint = "Push only works on the https:// site (or localhost), not over a plain LAN address.";
  } else if (!state.serverEnabled) {
    status = <StatusBadge tone="warning" label="Not set up" />;
    hint = "The server has no push keys yet. An admin adds VAPID keys to the backend settings.";
  } else if (state.permission === "denied") {
    status = <StatusBadge tone="danger" label="Blocked" />;
    hint = "Notifications are blocked for this site. Allow them in the browser's site settings, then enable here.";
  } else if (state.subscribed) {
    status = <StatusBadge tone="success" label="On for this device" />;
    hint = "New, assigned, reopened and overdue tickets reach this device even when SIMMS is closed.";
  } else {
    status = <StatusBadge tone="neutral" label="Off" />;
    hint = "Get alerts for new, assigned and overdue tickets even when SIMMS is closed.";
  }

  const canEnable = state && state.supported && state.secure && state.serverEnabled && !state.subscribed && state.permission !== "denied";

  return (
    <Card title="Phone notifications" subtitle="Push alerts on this device" icon="bell" actions={status}>
      <p className="text-sm leading-relaxed text-slate-600">{hint}</p>

      <div className="mt-4 flex flex-wrap gap-2">
        {canEnable && (
          <button
            type="button"
            className="btn btn-primary"
            disabled={Boolean(busy)}
            onClick={() => run("enable", enablePush, "Notifications are on for this device.")}
          >
            {busy === "enable" ? <Spinner /> : <Icon name="bell" className="h-4 w-4" />}
            Enable on this device
          </button>
        )}

        {state?.subscribed && (
          <>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={Boolean(busy)}
              onClick={() => run("test", sendTestPush, "Test sent. It should appear in a few seconds.")}
            >
              {busy === "test" ? <Spinner /> : <Icon name="send" className="h-4 w-4" />}
              Send a test
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={Boolean(busy)}
              onClick={() => run("disable", disablePush, "Notifications are off for this device.")}
            >
              {busy === "disable" ? <Spinner /> : <Icon name="x" className="h-4 w-4" />}
              Turn off
            </button>
          </>
        )}
      </div>

      {message && (
        <Alert tone={message.tone} className="mt-4" onDismiss={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}
    </Card>
  );
}
